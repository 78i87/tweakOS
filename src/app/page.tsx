'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import '@/apps/manifest';

import Desktop from '@/components/desktop/Desktop';
import DesktopIcons from '@/components/desktop/DesktopIcons';
import Dock from '@/components/desktop/Dock';
import PromptBar from '@/components/desktop/PromptBar';
import IridescenceOverlay from '@/components/desktop/IridescenceOverlay';
import { useAppRegistry } from '@/lib/useAppRegistry';
import { useWindowActions, useWindows } from '@/lib/useWindowActions';
import { attachAudioActivity } from '@/lib/audioActivity';
import { TerminalSquare, Camera } from 'lucide-react';

export default function Home() {
  const [showIntro, setShowIntro] = useState(false);
  const [showDesktopUI, setShowDesktopUI] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [terminalWindowCentered, setTerminalWindowCentered] = useState(false);
  const [overlayRevealing, setOverlayRevealing] = useState(false);
  const [showIridescenceIntro, setShowIridescenceIntro] = useState(false);
  const [introOverlayFading, setIntroOverlayFading] = useState(false);
  const { openAppWindow } = useAppRegistry();
  const { updateWindowPosition, updateWindowSize, closeWindow, updateWindowData, focusWindow } =
    useWindowActions();
  const windows = useWindows();
  const isCapturingRef = useRef(false);
  const [showCameraIndicator, setShowCameraIndicator] = useState(false);
  const cameraIndicatorTimeoutRef = useRef<number | null>(null);
  const guiReplyAudioRef = useRef<HTMLAudioElement | null>(null);
  const guiReplyAbortRef = useRef<AbortController | null>(null);
  const guiReplyAudioUrlRef = useRef<string | null>(null);

  const stopGUIreplyAudio = useCallback(() => {
    guiReplyAbortRef.current?.abort();
    guiReplyAbortRef.current = null;

    if (guiReplyAudioRef.current) {
      guiReplyAudioRef.current.pause();
      guiReplyAudioRef.current.currentTime = 0;
      guiReplyAudioRef.current = null;
    }

    if (guiReplyAudioUrlRef.current) {
      URL.revokeObjectURL(guiReplyAudioUrlRef.current);
      guiReplyAudioUrlRef.current = null;
    }

    window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
  }, []);

  useLayoutEffect(() => {
    // Check if intro has been seen before - decide before first paint
    const introSeen = localStorage.getItem('introSeen');
    if (!introSeen) {
      // Show terminal icon overlay first - iridescence will trigger from onStartReveal (~16s)
      setShowIntro(true);
      setShowIridescenceIntro(false);
    } else {
      setShowDesktopUI(true);
    }
  }, []);

  useEffect(() => {
    // Handle F key to skip intro (works for both iridescence and terminal intro)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((showIntro || showIridescenceIntro) && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        localStorage.setItem('introSeen', 'true');
        setShowIntro(false);
        setShowIridescenceIntro(false);
        setShowDesktopUI(true);
        // Close any terminal window that might have been opened
        const terminalWindow = windows.find(
          (w) => w.appId === 'terminal' && w.data?.fromIntro
        );
        if (terminalWindow) {
          closeWindow(terminalWindow.id);
        }
      }
    };

    if (showIntro || showIridescenceIntro) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showIntro, showIridescenceIntro, windows, closeWindow]);

  useEffect(() => {
    // Find terminal window opened from intro and center it (only once)
    if (showIntro && !introComplete && !terminalWindowCentered) {
      const terminalWindow = windows.find(
        (w) => w.appId === 'terminal' && w.data?.fromIntro
      );
      if (terminalWindow) {
        // Center window: 820x560 at center of screen
        const centerX = (window.innerWidth - 820) / 2;
        const centerY = (window.innerHeight - 560) / 2;
        updateWindowSize(terminalWindow.id, { width: 820, height: 560 });
        updateWindowPosition(terminalWindow.id, { x: centerX, y: centerY });
        setTerminalWindowCentered(true);
      }
    }
  }, [windows, showIntro, introComplete, terminalWindowCentered, updateWindowPosition, updateWindowSize]);

  const captureDisplayFrame = useCallback(async (): Promise<string | null> => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        console.warn('[Screenshot Hotkey] getDisplayMedia is not supported in this browser.');
        return null;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as MediaTrackConstraints,
        audio: false,
      });

      try {
        const track = stream.getVideoTracks()[0];
        if (!track) {
          console.warn('[Screenshot Hotkey] No video track available from display media.');
          return null;
        }

        const video = document.createElement('video');
        video.srcObject = stream;

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video
              .play()
              .then(() => resolve())
              .catch(() => resolve());
          };
        });

        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        if (width === 0 || height === 0) {
          console.warn('[Screenshot Hotkey] Video metadata missing dimensions.');
          return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('[Screenshot Hotkey] Failed to get canvas context.');
          return null;
        }

        ctx.drawImage(video, 0, 0, width, height);
        return canvas.toDataURL('image/png');
      } finally {
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === 'NotAllowedError' || error.name === 'AbortError')
      ) {
        console.warn('[Screenshot Hotkey] Capture cancelled by user.');
        return null;
      }
      console.error('[Screenshot Hotkey] Failed to capture display frame:', error);
      return null;
    }
  }, []);

  const playFallbackAudio = useCallback(async () => {
    try {
      // Cancel any existing audio
      if (guiReplyAudioRef.current) {
        guiReplyAudioRef.current.pause();
        guiReplyAudioRef.current.currentTime = 0;
        guiReplyAudioRef.current = null;
      }

      // Dispatch speaking start event
      window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: true } }));

      const audio = new Audio('/jane-script.mp3');
      guiReplyAudioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
          guiReplyAudioRef.current = null;
          resolve();
        };
        audio.onerror = (error) => {
          console.warn('[GUIreplyAgent Fallback] Audio playback error:', error);
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
          guiReplyAudioRef.current = null;
          resolve();
        };
        audio.play().catch((error) => {
          console.warn('[GUIreplyAgent Fallback] Audio play failed:', error);
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
          guiReplyAudioRef.current = null;
          resolve();
        });
      });
    } catch (error) {
      console.warn('[GUIreplyAgent Fallback] Error:', error);
      window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
    }
  }, []);

  const playGUIreplyAudio = useCallback(async (text: string) => {
    try {
      stopGUIreplyAudio();

      const abortController = new AbortController();
      guiReplyAbortRef.current = abortController;

      window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: true } }));

      // Call ElevenLabs API with Jane voice
      const response = await fetch('/api/elevenlabs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voiceId: 'RILOU7YmBhvwJGDGjNmP', // Jane voice
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBlob = await response.blob();

      if (abortController.signal.aborted) {
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      guiReplyAudioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      guiReplyAudioRef.current = audio;

      // Attach audio activity detector for real-time speech/silence detection
      const dispatchSpeaking = (speaking: boolean) => {
        window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking } }));
      };
      const cleanupActivity = attachAudioActivity(audio, {
        onSpeakingStart: () => dispatchSpeaking(true),
        onSpeakingStop: () => dispatchSpeaking(false),
      });

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          cleanupActivity();
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
          URL.revokeObjectURL(audioUrl);
          guiReplyAudioRef.current = null;
          guiReplyAudioUrlRef.current = null;
          resolve();
        };
        audio.onerror = (error) => {
          cleanupActivity();
          console.warn('[GUIreplyAgent TTS] Audio playback error:', error);
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
          URL.revokeObjectURL(audioUrl);
          guiReplyAudioRef.current = null;
          guiReplyAudioUrlRef.current = null;
          resolve();
        };
        audio.play().catch((error) => {
          cleanupActivity();
          console.warn('[GUIreplyAgent TTS] Audio play failed:', error);
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
          URL.revokeObjectURL(audioUrl);
          guiReplyAudioRef.current = null;
          guiReplyAudioUrlRef.current = null;
          // Fallback to prerecorded audio
          playFallbackAudio().then(() => resolve()).catch(() => resolve());
        });
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('[GUIreplyAgent TTS] ElevenLabs request aborted');
        return;
      }

      console.error('[GUIreplyAgent TTS] Error:', error);
      window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
      // Fallback to prerecorded audio
      await playFallbackAudio();
    }
  }, [playFallbackAudio, stopGUIreplyAudio]);

  const sendScreenshotToCliAgent = useCallback(async () => {
    if (isCapturingRef.current) {
      return;
    }
    isCapturingRef.current = true;

    try {
      const dataUrl = await captureDisplayFrame();
      if (!dataUrl) {
        return;
      }

      const activeWindow = windows
        .filter((w) => w.status !== 'minimized')
        .sort((a, b) => b.zIndex - a.zIndex)[0];

      const context = {
        capturedAt: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        activeWindow: activeWindow
          ? {
              appId: activeWindow.appId,
              title: activeWindow.title,
              aiView: Boolean(activeWindow.data?.aiHtml),
            }
          : null,
        browserUrl:
          activeWindow?.appId === 'browser'
            ? activeWindow.data?.url || null
            : null,
        openWindows: windows
          .filter((w) => w.status !== 'minimized')
          .map((w) => ({
            appId: w.appId,
            title: w.title,
          })),
      };

      const response = await fetch('/api/cliAgent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          screenshot: {
            dataUrl,
          },
          context,
        }),
      });

      if (!response.ok) {
        throw new Error(`cliAgent API error: ${response.status}`);
      }

      const data = await response.json().catch(() => ({}));
      const cliReply =
        typeof data?.reply === 'string' && data.reply.trim().length > 0
          ? data.reply.trim()
          : 'No response received from cliAgent.';

      // Route to Terminal instead of Notepad
      const terminalWindow = windows.find((w) => w.appId === 'terminal');
      if (terminalWindow) {
        updateWindowData(terminalWindow.id, { aiInjectText: cliReply });
        // Focus the terminal window
        focusWindow(terminalWindow.id);
      } else {
        openAppWindow('terminal', { aiInjectText: cliReply });
      }

      // Now call GUIreplyAgent with the cliReply
      try {
        const guiResponse = await fetch('/api/GUIreplyAgent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cliReply,
          }),
        });

        if (!guiResponse.ok) {
          console.warn('[Screenshot Hotkey] GUIreplyAgent API error:', guiResponse.status);
          // Fallback to prerecorded audio
          await playFallbackAudio();
          return;
        }

        const guiData = await guiResponse.json().catch(() => ({}));
        const guiReply =
          typeof guiData?.reply === 'string' && guiData.reply.trim().length > 0
            ? guiData.reply.trim()
            : null;

        if (!guiReply) {
          console.warn('[Screenshot Hotkey] No reply from GUIreplyAgent');
          await playFallbackAudio();
          return;
        }

        // Synthesize speech using ElevenLabs with Jane voice
        await playGUIreplyAudio(guiReply);
      } catch (guiError) {
        console.error('[Screenshot Hotkey] Failed to get GUIreplyAgent response:', guiError);
        // Fallback to prerecorded audio
        await playFallbackAudio();
      }
    } catch (error) {
      console.error('[Screenshot Hotkey] Failed to send screenshot to cliAgent:', error);
    } finally {
      isCapturingRef.current = false;
    }
  }, [captureDisplayFrame, openAppWindow, updateWindowData, windows, focusWindow, playGUIreplyAudio, playFallbackAudio]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isModifierPressed = event.ctrlKey || event.metaKey;

      if (isModifierPressed && key === 'e') {
        event.preventDefault();
        if (isCapturingRef.current) {
          // Busy: ignore trigger and do NOT show indicator
          return;
        }
        // Restart indicator animation
        if (cameraIndicatorTimeoutRef.current) {
          clearTimeout(cameraIndicatorTimeoutRef.current);
          cameraIndicatorTimeoutRef.current = null;
        }
        setShowCameraIndicator(false);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setShowCameraIndicator(true);
            cameraIndicatorTimeoutRef.current = window.setTimeout(() => {
              setShowCameraIndicator(false);
              cameraIndicatorTimeoutRef.current = null;
            }, 2000);
          })
        );

        console.log('[Screenshot Hotkey] Ctrl/Cmd+E pressed - initiating screenshot capture');
        sendScreenshotToCliAgent();
        return;
      }

      if (isModifierPressed && key === 'i') {
        event.preventDefault();
        console.log('[GUIreplyAgent TTS] Ctrl/Cmd+I pressed - stopping playback');
        stopGUIreplyAudio();
        return;
      }

      // Editable guard applies to other keys only
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isEditableTarget) {
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sendScreenshotToCliAgent, stopGUIreplyAudio]);

  useEffect(() => {
    return () => {
      if (cameraIndicatorTimeoutRef.current) {
        clearTimeout(cameraIndicatorTimeoutRef.current);
        cameraIndicatorTimeoutRef.current = null;
      }
    };
  }, []);

  const handleTerminalIconClick = () => {
    // Open terminal with callbacks
    openAppWindow('terminal', {
      fromIntro: true,
      onStartReveal: () => {
        // Start both overlays simultaneously for smooth crossfade
        // Brown overlay fades out slowly (8 seconds) while iridescence fades in (3 seconds)
        setShowIridescenceIntro(true);
        setIntroOverlayFading(true);
        // After brown overlay fade completes (8 seconds), unmount it
        setTimeout(() => {
          setShowIntro(false);
          setIntroOverlayFading(false);
        }, 8000); // Match the 8-second fade-out duration
      },
      onStartupComplete: () => {
        // Wait 4 seconds after script completion
        setTimeout(() => {
          setIntroComplete(true);
          setShowDesktopUI(true);
          localStorage.setItem('introSeen', 'true');
        }, 4000);
      },
      onSkipIntro: () => {
        // Skip intro immediately - close terminal, hide overlay, show desktop
        const terminalWindow = windows.find(
          (w) => w.appId === 'terminal' && w.data?.fromIntro
        );
        if (terminalWindow) {
          closeWindow(terminalWindow.id);
        }
        localStorage.setItem('introSeen', 'true');
        setShowIntro(false);
        setShowDesktopUI(true);
      },
    });
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="absolute inset-0">
        <Desktop />
      </div>
      {showDesktopUI && (
        <>
          <DesktopIcons />
          <Dock />
        </>
      )}
      {/* Always show PromptBar - blob appears during intro when speaking */}
      <PromptBar showBlob={true} shrinkWhenNotSpeaking={showIntro || showIridescenceIntro} />
      {/* Iridescence intro overlay - OGL shader effect */}
      {showIridescenceIntro && (
        <IridescenceOverlay
          startNow={true}
          mouseReact={false}
          onComplete={() => {
            setShowIridescenceIntro(false);
            // After iridescence effect completes, terminal flow continues
            // Desktop will show after onStartupComplete callback
          }}
        />
      )}
      {/* Camera indicator */}
      {showCameraIndicator && (
        <div
          className="fixed top-4 right-4 z-[2000] flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-opacity duration-300"
          style={{
            background: 'var(--dark-brown-accent)',
            border: '2px solid var(--beige-accent)',
            animation: 'fadeInOut 2s ease-in-out',
          }}
        >
          <Camera size={20} style={{ color: 'var(--beige-accent)' }} />
        </div>
      )}
      {/* Terminal icon overlay - crossfades with iridescence overlay */}
      {showIntro && (
        <div
          className={`intro-overlay flex items-center justify-center ${overlayRevealing ? 'revealing' : ''} ${introOverlayFading ? 'fade-out' : ''}`}
        >
          <button
            onClick={handleTerminalIconClick}
            className="flex flex-col items-center gap-4 p-6 rounded-lg transition-opacity hover:opacity-80 active:opacity-60 cursor-pointer"
            aria-label="Terminal"
          >
            <div className="w-24 h-24 flex items-center justify-center" style={{ color: 'var(--dark-brown-text)' }}>
              <TerminalSquare size={96} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
