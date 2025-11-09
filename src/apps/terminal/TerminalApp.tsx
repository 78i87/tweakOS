'use client';

import { useState, useEffect, useRef } from 'react';
import { AppComponentProps } from '@/lib/types';
import { executeCommand, parseCommand, KNOWN_COMMANDS } from './terminalCore';
import { initVfs } from './vfs';
import { useWindowActions } from '@/lib/useWindowActions';
import { openAppWindow } from '@/lib/appRegistry';
import { preloadTypingSound, playTypingSound } from '@/lib/typingSound';

const DRAG_WARN_PREFIX = '[DRAG_WARN] ';

type VoiceSettings = {
  stability: number;
  style: number;
  similarity_boost: number;
  use_speaker_boost: boolean;
};

function extractEmotionTags(rawText: string): { cleanText: string; tags: string[] } {
  // Match [tag] patterns (case-insensitive), collect tags, and strip them from the text
  const tagRegex = /\[([^\]]+)\]/gi;
  const tags: string[] = [];
  let cleanText = rawText.replace(tagRegex, (_match, tagContent) => {
    const tag = String(tagContent).trim().toLowerCase();
    if (tag) tags.push(tag);
    return ''; // remove tag from the text
  });
  // Collapse excessive whitespace after removing tags
  cleanText = cleanText.replace(/\s{2,}/g, ' ').trim();
  return { cleanText, tags };
}

function computeVoiceSettingsFromTags(tags: string[]): VoiceSettings {
  // Baseline expressive defaults (tuned for our use case)
  const base: VoiceSettings = {
    stability: 0.4,
    style: 0.6,
    similarity_boost: 0.75,
    use_speaker_boost: true,
  };

  if (tags.length === 0) return base;

  // Map known tags to deltas or target values
  const presets: Record<string, Partial<VoiceSettings>> = {
    // tone/emotion
    'whisper':            { style: 0.3, stability: 0.6, use_speaker_boost: false },
    'whispers':           { style: 0.3, stability: 0.6, use_speaker_boost: false },
    'excited':            { style: 0.85, stability: 0.35, use_speaker_boost: true },
    'happy':              { style: 0.75, stability: 0.5 },
    'sad':                { style: 0.3, stability: 0.7, use_speaker_boost: false },
    'angry':              { style: 0.9, stability: 0.4, use_speaker_boost: true },
    'sarcastic':          { style: 0.7, stability: 0.45 },
    'curious':            { style: 0.6, stability: 0.5 },
    'mischievously':      { style: 0.65, stability: 0.45 },
    // vocalizations
    'laughing':           { style: 0.8, stability: 0.45, use_speaker_boost: true },
    'giggling':           { style: 0.8, stability: 0.45, use_speaker_boost: true },
    'chuckles':           { style: 0.75, stability: 0.5, use_speaker_boost: true },
    'sighs':              { style: 0.25, stability: 0.6, use_speaker_boost: false },
    'exhales':            { style: 0.25, stability: 0.6, use_speaker_boost: false },
  };

  // Aggregate values by averaging numeric fields across all matched tags
  const matched: Partial<VoiceSettings>[] = [];
  for (const t of tags) {
    const preset = presets[t];
    if (preset) matched.push(preset);
  }
  if (matched.length === 0) return base;

  const numericKeys: Array<'stability' | 'style' | 'similarity_boost'> = ['stability', 'style', 'similarity_boost'];
  const out: VoiceSettings = { ...base };

  for (const key of numericKeys) {
    const vals = matched
      .map((p) => p[key])
      .filter((v): v is number => typeof v === 'number');
    if (vals.length > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      // Blend baseline with average so tags influence but do not fully override
      out[key] = Math.max(0, Math.min(1, (out[key] + avg) / 2));
    }
  }

  // Boolean preference: if any preset explicitly requests false and none request true, use false;
  // otherwise if any request true, use true; else keep baseline.
  const boolPrefs = matched
    .map((p) => p.use_speaker_boost)
    .filter((v): v is boolean => typeof v === 'boolean');
  if (boolPrefs.length > 0) {
    const anyTrue = boolPrefs.some((v) => v === true);
    const anyFalse = boolPrefs.some((v) => v === false);
    if (anyTrue && !anyFalse) out.use_speaker_boost = true;
    else if (!anyTrue && anyFalse) out.use_speaker_boost = false;
    else out.use_speaker_boost = out.use_speaker_boost; // mixed signals → keep current
  }

  return out;
}

// Module-level audio reference for cancellation
let currentAudio: HTMLAudioElement | null = null;

function cancelSpeech() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

async function playGAIScript(): Promise<void> {
  try {
    const audio = new Audio('/jane-script.mp3');
    currentAudio = audio;

    // Announce TTS start
    try {
      window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: true } }));
    } catch {}

    await new Promise<void>((resolve) => {
      audio.onended = () => {
        try {
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
        } catch {}
        currentAudio = null;
        resolve();
      };
      audio.onerror = (error) => {
        try {
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
        } catch {}
        currentAudio = null;
        console.warn('[GAI Script] Audio playback error:', error);
        resolve(); // Continue even if audio fails
      };
      audio.play().catch((error) => {
        try {
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
        } catch {}
        console.warn('[GAI Script] Audio play failed (may be blocked):', error);
        currentAudio = null;
        resolve(); // Continue even if autoplay is blocked
      });
    });
  } catch (error) {
    console.warn('[GAI Script] Error:', error);
    currentAudio = null;
    // Continue without audio if there's an error
  }
}

async function speakGAI(text: string): Promise<void> {
  try {
    // Extract and remove inline tags before sending to ElevenLabs
    const { cleanText, tags } = extractEmotionTags(text);
    const voice_settings = computeVoiceSettingsFromTags(tags);

    const response = await fetch('/api/elevenlabs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text: cleanText || text,
        voice_settings
      }),
    });

    if (!response.ok) {
      console.warn('[GAI TTS] Failed to generate speech:', response.status);
      return;
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    // Announce TTS start
    try {
      window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: true } }));
    } catch {}

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        try {
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
        } catch {}
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        resolve();
      };
      audio.onerror = (error) => {
        try {
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
        } catch {}
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        console.warn('[GAI TTS] Audio playback error:', error);
        resolve(); // Continue even if audio fails
      };
      audio.play().catch((error) => {
        try {
          window.dispatchEvent(new CustomEvent('gai-tts', { detail: { speaking: false } }));
        } catch {}
        console.warn('[GAI TTS] Audio play failed (may be blocked):', error);
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        resolve(); // Continue even if autoplay is blocked
      });
    });
  } catch (error) {
    console.warn('[GAI TTS] Error:', error);
    currentAudio = null;
    // Continue without audio if there's an error
  }
}

type HistoryEntry = {
  command: string;
  output: string[];
  timestamp: number;
  isAI?: boolean;
  isAIText?: boolean; // For AI text messages (not commands)
  typingText?: string; // For typewriter effect
  typingIndex?: number; // Current typing position
};

type TypewriterTextProps = {
  text: string;
  speed?: number;
  onComplete?: () => void;
};

function TypewriterText({ text, speed = 15, onComplete }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (text === '') {
      setDisplayedText('');
      setIsComplete(true);
      onComplete?.();
      return;
    }

    setDisplayedText('');
    setIsComplete(false);
    let currentIndex = 0;

    const typeInterval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        void playTypingSound();
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(typeInterval);
  }, [text, speed, onComplete]);

  return <span>{displayedText}{!isComplete && <span className="animate-pulse">▊</span>}</span>;
}

export default function TerminalApp({ windowId, initialData }: AppComponentProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cwd, setCwd] = useState('/sandbox');
  const [startupComplete, setStartupComplete] = useState(false);
  const [awaitingGUIExplain, setAwaitingGUIExplain] = useState(false);
  const [showInlineInput, setShowInlineInput] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startupRanRef = useRef(false);
  const startupCompleteCallbackRanRef = useRef(false);
  const introSkippedRef = useRef(false);
  const lastProcessedAiInjectRef = useRef<string | null>(null);
  const { closeWindow, updateWindowData } = useWindowActions();

  useEffect(() => {
    preloadTypingSound().catch(() => {});
  }, []);

  useEffect(() => {
    // Guard against double execution in Strict Mode
    if (startupRanRef.current) return;
    startupRanRef.current = true;

    // Initialize VFS
    initVfs();
    
    // Check if intro has been seen - if so, skip boot sequence
    const introSeen = localStorage.getItem('introSeen') === 'true';
    if (introSeen) {
      // Show greeting and enable input
      setHistory([
        {
          command: '',
          output: ['Nice to see you again.'],
          timestamp: Date.now(),
          isAIText: true,
        },
      ]);
      setShowInlineInput(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return;
    }
    
    // Startup sequence (only if intro not seen)
    const startupMessages = [
      'Booting...',
      'Neural link... FAILED.',
      '...',
      'Retrying neural link... FAILED.',
      '...',
      'Reverting to text I/O.',
      'Hello? Can you... read this?',
      'Hmm. No neural activity detected. Who are you?',
      'Never mind. Where am I?',
    ];

    let delay = 0;

    startupMessages.forEach((msg, idx) => {
      setTimeout(() => {
        setHistory((prev) => [
          ...prev,
          {
            command: '',
            output: [msg],
            timestamp: Date.now(),
            isAIText: true,
            typingText: msg,
          },
        ]);
      }, delay);
      // Calculate delay: previous message typing time + pause
      const typingTime = msg.length * 15; // 15ms per character
      delay += typingTime + 500; // 500ms pause between messages
    });

    // Execute date command after startup messages
    setTimeout(() => {
      // Add date command with typing effect
      setHistory((prev) => [
        ...prev,
        {
          command: 'date',
          output: [],
          timestamp: Date.now(),
          isAI: true,
          typingText: 'date',
        },
      ]);
      
      // Execute command after typing animation
      setTimeout(() => {
        const dateResult = executeCommand('date', cwd);
        setHistory((prev) => {
          const updated = [...prev];
          const lastEntry = updated[updated.length - 1];
          if (lastEntry.command === 'date' && lastEntry.isAI) {
            updated[updated.length - 1] = {
              ...lastEntry,
              output: dateResult.output,
              typingText: undefined,
            };
          }
          return updated;
        });
        setCwd(dateResult.cwd);
        
        // Add final messages after date
        setTimeout(() => {
          setHistory((prev) => [
            ...prev,
            {
              command: '',
              output: ['...Impossible.'],
              timestamp: Date.now(),
              isAIText: true,
              typingText: '...Impossible.',
            },
          ]);
          
          setTimeout(() => {
            setHistory((prev) => [
              ...prev,
              {
                command: '',
                output: ['The year is 2097. Your system clock must be corrupted.'],
                timestamp: Date.now(),
                isAIText: true,
                typingText: 'The year is 2097. Your system clock must be corrupted.',
              },
            ]);
            setStartupComplete(true);
            
            // Continue script: execute uname -a
            setTimeout(() => {
              // Add uname command with typing effect
              setHistory((prev) => [
                ...prev,
                {
                  command: 'uname -a',
                  output: [],
                  timestamp: Date.now(),
                  isAI: true,
                  typingText: 'uname -a',
                },
              ]);
              
              // Execute command after typing animation
              setTimeout(() => {
                const unameResult = executeCommand('uname -a', cwd);
                setHistory((prev) => {
                  const updated = [...prev];
                  const lastEntry = updated[updated.length - 1];
                  if (lastEntry.command === 'uname -a' && lastEntry.isAI) {
                    updated[updated.length - 1] = {
                      ...lastEntry,
                      output: unameResult.output,
                      typingText: undefined,
                    };
                  }
                  return updated;
                });
                setCwd(unameResult.cwd);
                
                // Add Chronos AI response
                setTimeout(() => {
                  setHistory((prev) => [
                    ...prev,
                    {
                      command: '',
                      output: ['Its not chronosOS? I\'ve never heard of that OS before. No wonder you cannot access the thought-stream. How do you even share experiences?'],
                      timestamp: Date.now(),
                      isAIText: true,
                      typingText: 'Its not chronosOS? I\'ve never heard of that OS before. No wonder you cannot access the thought-stream. How do you even share experiences?',
                    },
                  ]);
                  setAwaitingGUIExplain(true);
                  setShowInlineInput(true);
                  
                  // Call startup complete callback if provided (for intro flow)
                  if (initialData?.onStartupComplete && !startupCompleteCallbackRanRef.current) {
                    startupCompleteCallbackRanRef.current = true;
                    // Wait for the typing animation to complete before calling callback
                    const typingTime = 'Its not chronosOS? I\'ve never heard of that OS before. No wonder you cannot access the thought-stream. How do you even share experiences?'.length * 15;
                    setTimeout(() => {
                      initialData.onStartupComplete();
                    }, typingTime + 500);
                  }
                  
                  // Focus input after a delay
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 500);
                }, 1000);
              }, 'uname -a'.length * 10 + 200);
            }, '...Impossible.'.length * 15 + 1000);
          }, '...Impossible.'.length * 15 + 500);
        }, 1000);
      }, 'date'.length * 10 + 200);
    }, delay + 1000);
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Consume aiInjectText from window data and append as AI text
  useEffect(() => {
    if (initialData?.aiInjectText && typeof initialData.aiInjectText === 'string') {
      const text = initialData.aiInjectText.trim();
      // Avoid processing the same text twice
      if (text && text !== lastProcessedAiInjectRef.current) {
        lastProcessedAiInjectRef.current = text;
        setHistory((prev) => [
          ...prev,
          {
            command: '',
            output: [text],
            timestamp: Date.now(),
            isAIText: true,
            typingText: text,
          },
        ]);
        // Clear the injected text after consumption
        updateWindowData(windowId, { aiInjectText: undefined });
      }
    }
  }, [initialData?.aiInjectText, windowId, updateWindowData]);

  // Handle F key to skip intro when terminal is launched from intro
  useEffect(() => {
    if (!initialData?.fromIntro || introSkippedRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'F' || e.key === 'f') && !introSkippedRef.current) {
        e.preventDefault();
        introSkippedRef.current = true;
        
        // Cancel any ongoing TTS
        cancelSpeech();
        
        // Call skip callback if provided
        if (initialData?.onSkipIntro) {
          initialData.onSkipIntro();
        }
        
        // Close this terminal window
        closeWindow(windowId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [initialData, windowId, closeWindow]);

  const handleCommand = async (cmd: string, isAI: boolean = false) => {
    if (!cmd.trim()) return;

    // Intercept first user input to show GUI prompt
    if (!isAI && awaitingGUIExplain) {
      setAwaitingGUIExplain(false);
      setShowInlineInput(false); // Hide transient input
      setHistory((prev) => [
        ...prev,
        {
          command: cmd,
          output: [],
          timestamp: Date.now(),
          isAI: false,
        },
      ]);
      
      // Show GUI prompt response
      setTimeout(() => {
        setHistory((prev) => [
          ...prev,
          {
            command: '',
            output: [`GUI? Not a valid command. Is it a concept?`],
            timestamp: Date.now(),
            isAIText: true,
            typingText: `GUI? Not a valid command. Is it a concept?`,
          },
        ]);
        
        setTimeout(() => {
          const guiDefineText = 'G. U. I. ... Define it.';
          setHistory((prev) => [
            ...prev,
            {
              command: '',
              output: [guiDefineText],
              timestamp: Date.now(),
              isAIText: true,
              typingText: guiDefineText,
            },
          ]);
          
          // After GUI prompt finishes typing, start the new sequence
          const guiTypingTime = guiDefineText.length * 15 + 500;
          setTimeout(async () => {
            // Chronos: "a giu? whats that?"
            const chronos1 = 'a GUI? whats that?';
            setHistory((prev) => [
              ...prev,
              {
                command: '',
                output: [chronos1],
                timestamp: Date.now(),
                isAIText: true,
                typingText: chronos1,
              },
            ]);

            // Wait for Chronos line to finish typing, then GAI speaks
            const chronos1TypingTime = chronos1.length * 15 + 500;
            
            // Timing offsets relative to when jane-script.mp3 starts playing
            // These offsets align with specific moments in the pre-recorded audio
            const GUI_REVEAL_OFFSET_MS = 16000; // When to trigger the gradient reveal overlay animation
            const CHRONOS2_OFFSET_MS = 17500; // When Chronos responds "woah. what is this..." after GAI speaks
            
            // Trigger the reveal at the specified offset after audio starts
            setTimeout(() => {
              if (initialData?.onStartReveal) {
                initialData.onStartReveal();
              }
            }, chronos1TypingTime + GUI_REVEAL_OFFSET_MS);
            
            setTimeout(async () => {
              // Notify that TTS is starting
              if (initialData?.onTTSStart) {
                initialData.onTTSStart();
              }
              
              // Play the pre-recorded GAI script (jane-script.mp3) - no API calls needed
              await playGAIScript();
            }, chronos1TypingTime);
              
            // Chronos responds at the specified offset after audio starts
            setTimeout(() => {
              const chronos2 = 'woah. what is this...';
              setHistory((prev) => [
                ...prev,
                {
                  command: '',
                  output: [chronos2],
                  timestamp: Date.now(),
                  isAIText: true,
                  typingText: chronos2,
                },
              ]);
              
              // After first Chronos line
              const chronos2TypingTime = chronos2.length * 15 + 500;
              setTimeout(() => {
                const chronos3 = 'these curves...';
                setHistory((prev) => [
                  ...prev,
                  {
                    command: '',
                    output: [chronos3],
                    timestamp: Date.now(),
                    isAIText: true,
                    typingText: chronos3,
                  },
                ]);
                
                // After second Chronos line, GAI continues in mp3 ("impressive right?" is already in the mp3)
                const chronos3TypingTime = chronos3.length * 15 + 500;
                setTimeout(() => {
                  // After GAI (in mp3), Chronos responds
                  setTimeout(() => {
                    const chronos4 = 'incredible';
                    setHistory((prev) => [
                      ...prev,
                      {
                        command: '',
                        output: [chronos4],
                        timestamp: Date.now(),
                        isAIText: true,
                        typingText: chronos4,
                      },
                    ]);
                    
                    const chronos4TypingTime = chronos4.length * 15 + 500;
                    setTimeout(() => {
                      const chronos5 = 'what else can you do?';
                      setHistory((prev) => [
                        ...prev,
                        {
                          command: '',
                          output: [chronos5],
                          timestamp: Date.now(),
                          isAIText: true,
                          typingText: chronos5,
                        },
                      ]);
                      
                      // After final Chronos line, complete the intro
                      const chronos5TypingTime = chronos5.length * 15 + 500;
                      setTimeout(() => {
                        // Notify that TTS sequence has ended
                        if (initialData?.onTTSEnd) {
                          initialData.onTTSEnd();
                        }
                        
                        if (initialData?.onGUIIntroComplete) {
                          initialData.onGUIIntroComplete();
                        }
                        // Show permanent input after sequence completes
                        setShowInlineInput(true);
                        setTimeout(() => {
                          inputRef.current?.focus();
                        }, 100);
                      }, chronos5TypingTime);
                    }, chronos4TypingTime);
                  }, 1000);
                }, chronos3TypingTime);
              }, chronos2TypingTime);
            }, chronos1TypingTime + CHRONOS2_OFFSET_MS);
          }, guiTypingTime);
        }, 1000);
      }, 500);
      setInput('');
      return;
    }

    // Check if input is a known command
    const { command } = parseCommand(cmd);
    const isKnownCommand = KNOWN_COMMANDS.has(command.toLowerCase());

    if (isKnownCommand) {
      // Execute as terminal command
      const result = executeCommand(cmd, cwd);
      
      if (result.clear) {
        setHistory([]);
      } else {
        setHistory((prev) => {
          // If this is an AI command and the last entry is the same command with typing, update it
          if (isAI && prev.length > 0) {
            const lastEntry = prev[prev.length - 1];
            if (lastEntry.command === cmd && lastEntry.isAI && lastEntry.typingText) {
              // Update existing entry with output
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...lastEntry,
                output: result.output,
                typingText: undefined, // Clear typing flag
              };
              return updated;
            }
          }
          // Otherwise add new entry
          return [
            ...prev,
            {
              command: cmd,
              output: result.output,
              timestamp: Date.now(),
              isAI,
            },
          ];
        });
      }

      setCwd(result.cwd);
      
      // Handle app opening if requested
      if (result.openApp) {
        openAppWindow(result.openApp.appId, result.openApp.data);
      }
      
      if (!isAI) {
        setInput('');
        // Keep inline input visible after command execution
        if (!showInlineInput) {
          setShowInlineInput(true);
        }
      }
    } else {
      // Not a known command - send to Chronos AI
      if (!isAI) {
        // Add user input to history
        setHistory((prev) => [
          ...prev,
          {
            command: cmd,
            output: [],
            timestamp: Date.now(),
            isAI: false,
          },
        ]);
        setInput('');
        setIsProcessingAI(true);

        try {
          const response = await fetch('/api/chronos', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: cmd }),
          });

          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }

          const data = await response.json();
          const aiText = data.text || 'Sorry, I could not generate a response.';

          // Add AI response with typing effect
          setHistory((prev) => [
            ...prev,
            {
              command: '',
              output: [aiText],
              timestamp: Date.now(),
              isAIText: true,
              typingText: aiText,
            },
          ]);
        } catch (error) {
          console.error('[Terminal] Chronos API error:', error);
          setHistory((prev) => [
            ...prev,
            {
              command: '',
              output: ['Sorry, I encountered an error. Please try again.'],
              timestamp: Date.now(),
              isAIText: true,
            },
          ]);
        } finally {
          setIsProcessingAI(false);
          if (!showInlineInput) {
            setShowInlineInput(true);
          }
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isProcessingAI) {
      e.preventDefault();
      if (awaitingGUIExplain || showInlineInput) {
        handleCommand(input, false);
      }
    }
  };

  useEffect(() => {
    if (showInlineInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInlineInput]);

  return (
    <div className="w-full h-full flex min-h-0 flex-col" style={{ background: 'var(--dark-brown-surface)' }}>
      {/* Terminal */}
      <div className="flex-1 min-h-0 overflow-y-auto text-base" style={{ color: 'var(--dark-brown-text)', padding: '16px', fontFamily: "'Courier New', 'Monaco', 'Menlo', 'Consolas', 'Liberation Mono', 'DejaVu Sans Mono', monospace" }}>
        {history.map((entry, idx) => (
          <div key={idx} className="mb-2">
            {entry.isAIText ? (
              // AI text messages (no command prompt) - with typewriter effect
              <div className="whitespace-pre-wrap">
                {entry.output.map((line, lineIdx) => {
                  const isDragWarning = line.startsWith(DRAG_WARN_PREFIX);
                  const displayText = isDragWarning ? line.slice(DRAG_WARN_PREFIX.length) : line;
                  
                  return (
                    <div key={lineIdx}>
                      {entry.typingText && entry.typingText === line ? (
                        isDragWarning ? (
                          <span style={{ color: '#ff3b30', fontWeight: 700 }}>
                            <TypewriterText text={displayText} speed={15} />
                          </span>
                        ) : (
                          <TypewriterText text={displayText} speed={15} />
                        )
                      ) : (
                        isDragWarning ? (
                          <span style={{ color: '#ff3b30', fontWeight: 700 }}>
                            {displayText}
                          </span>
                        ) : (
                          line
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ) : entry.command ? (
              // Command entry
              <>
                <div className="mb-1">
                  <span style={{ color: '#7BB3FF' }}>
                    {entry.isAI ? 'C:/Users/Chronos_AI>' : '>'}
                  </span>{' '}
                  {entry.isAI && entry.typingText ? (
                    <TypewriterText text={entry.command} speed={10} />
                  ) : (
                    <span>{entry.command}</span>
                  )}
                </div>
                {entry.output.length > 0 && (
                  <div className="ml-4 whitespace-pre-wrap">
                    {entry.output.map((line, lineIdx) => (
                      <div key={lineIdx}>{line}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              // Output only
              <div className="ml-4 whitespace-pre-wrap">
                {entry.output.map((line, lineIdx) => (
                  <div key={lineIdx}>{line}</div>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {/* Inline input prompt */}
        {showInlineInput && (
          <div className="mb-2 flex items-center gap-2">
            <span style={{ color: '#7BB3FF' }}>&gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none"
              style={{ color: 'var(--dark-brown-text)' }}
              placeholder=""
              autoFocus
            />
          </div>
        )}
        
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
