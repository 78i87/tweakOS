'use client';

import { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { makeAppFromHTML } from '@/lib/appRegistry';
import { getPromptPlaceholder } from '@/lib/promptText';
import { useAnimatedText } from '@/hooks/useAnimatedText';
import { useWindows, useWindowActions } from '@/lib/useWindowActions';
import clsx from 'clsx';
import './blob-indicator.css';

type PromptBarProps = {
  showBlob?: boolean;
  shrinkWhenNotSpeaking?: boolean;
};

export default function PromptBar({ showBlob = true, shrinkWhenNotSpeaking = false }: PromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [blobPosition, setBlobPosition] = useState({ x: 0, y: 0 });
  const [showOverlay, setShowOverlay] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [isBlobAppearing, setIsBlobAppearing] = useState(true); // Track if blob is first appearing
  const [isBlobZooming, setIsBlobZooming] = useState(false); // Track if blob is zooming out
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const dragStartPositionRef = useRef({ x: 0, y: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const windows = useWindows();
  const { updateWindowData } = useWindowActions();
  
  // Find the browser window with highest zIndex (most focused)
  const browserWindow = windows
    .filter(w => w.appId === 'browser' && w.status !== 'minimized')
    .sort((a, b) => b.zIndex - a.zIndex)[0];
  
  const placeholderText = getPromptPlaceholder();
  const animatedPlaceholderText = useAnimatedText(
    placeholderText,
    showOverlay && isModalOpen,
    40
  );

  useEffect(() => {
    if (!isModalOpen) {
      setShowOverlay(true);
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (isModalOpen && inputRef.current && showOverlay) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    }
  }, [isModalOpen, showOverlay]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt, isModalOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ speaking: boolean }>;
      const speaking = !!customEvent?.detail?.speaking;
      setIsSpeaking(speaking);
      if (speaking) {
        setHasSpoken(true);
        // If blob is appearing for the first time, trigger zoom animation
        if (isBlobAppearing) {
          setIsBlobAppearing(false);
          setIsBlobZooming(true);
          // Remove zooming class after animation completes
          setTimeout(() => {
            setIsBlobZooming(false);
          }, 600);
        }
      }
    };
    window.addEventListener('gai-tts', handler as EventListener);
    return () => window.removeEventListener('gai-tts', handler as EventListener);
  }, [isBlobAppearing]);

  // On initial appearance, zoom the blob from tiny dot to normal size
  useEffect(() => {
    if (!isBlobAppearing) return;
    // Start zoom on next frame to ensure initial small state is applied
    const rafId = requestAnimationFrame(() => {
      setIsBlobZooming(true);
      // After animation completes, clear flags
      const timeout = setTimeout(() => {
        setIsBlobZooming(false);
        setIsBlobAppearing(false);
      }, 650);
      return () => clearTimeout(timeout);
    });
    return () => cancelAnimationFrame(rafId);
  }, [isBlobAppearing]);

  useEffect(() => {
    setBlobPosition({
      x: window.innerWidth - 80 - 24,
      y: window.innerHeight - 80 - 24,
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const isNearBottomRight = 
        Math.abs(blobPosition.x - (window.innerWidth - 80 - 24)) < 50 &&
        Math.abs(blobPosition.y - (window.innerHeight - 80 - 24)) < 50;
      
      if (isNearBottomRight) {
        setBlobPosition({
          x: window.innerWidth - 80 - 24,
          y: window.innerHeight - 80 - 24,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [blobPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isModalOpen &&
        modalRef.current &&
        !modalRef.current.contains(event.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (!isLoading) {
          setIsModalOpen(false);
        }
      }
    };

    if (isModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isModalOpen, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!prompt.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsModalOpen(true);

    try {
      // Get siteUrl from browser window if it exists
      const siteUrl = browserWindow?.data?.url || null;
      
      const response = await fetch('/api/GUIAgent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, siteUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.title || !data.html) {
        throw new Error('Invalid response format from API');
      }

      // If browser window exists and we have a siteUrl, inject HTML into browser
      if (browserWindow && siteUrl) {
        updateWindowData(browserWindow.id, { 
          aiHtml: data.html,
          aiTheme: prompt 
        });
      } else {
        // Fallback to creating a new HTML app window
        makeAppFromHTML({
          title: data.title,
          html: data.html,
        });
      }
      
      // Play success sound
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio('/AI_finish.mp3');
        }
        audioRef.current.play().catch(() => {
          // Silently handle audio playback errors (e.g., user interaction required)
        });
      } catch (err) {
        // Silently handle audio creation/playback errors
      }
      
      setPrompt('');
      setShowOverlay(true);
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsModalOpen(false);
    }
  };

  const handleFocus = () => {
    if (prompt.trim()) {
      setShowOverlay(false);
    }
  };

  const handleBlur = () => {
    if (!prompt.trim()) {
      setShowOverlay(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    setError(null);
    if (e.target.value.trim()) {
      setShowOverlay(false);
    } else {
      setShowOverlay(true);
    }
  };

  const handleDoubleClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setIsModalOpen(true);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleDragStart = () => {
    dragStartPositionRef.current = { ...blobPosition };
    didDragRef.current = false;
  };

  const handleDragStop = (_e: unknown, d: { x: number; y: number }) => {
    const moved = Math.abs(d.x - dragStartPositionRef.current.x) > 5 || 
                  Math.abs(d.y - dragStartPositionRef.current.y) > 5;
    
    if (moved) {
      didDragRef.current = true;
      setBlobPosition({ x: d.x, y: d.y });
      setTimeout(() => {
        didDragRef.current = false;
      }, 100);
    } else {
      didDragRef.current = false;
    }
  };

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
          </filter>
        </defs>
      </svg>

      {showBlob && (!shrinkWhenNotSpeaking || hasSpoken) && (
        <Rnd
          position={blobPosition}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          enableResizing={false}
          bounds="window"
          style={{ position: 'absolute', zIndex: 9999 }}
        >
          <div 
            ref={containerRef}
            className="cursor-move"
            onDoubleClick={handleDoubleClick}
          >
            <div className={clsx(
              'blob-indicator w-20 h-20',
              (isLoading || isSpeaking) && 'blob-thinking',
              (isLoading || isSpeaking) && 'blob-active',
              shrinkWhenNotSpeaking && !isSpeaking && !isLoading && 'blob-shrunk',
              isBlobAppearing && 'blob-appearing',
              isBlobZooming && 'blob-zooming'
            )}>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        </Rnd>
      )}

      {isModalOpen && (
        <div
          ref={modalRef}
          className="fixed z-[9999] transition-all duration-300 ease-out"
          style={{
            top: `${blobPosition.y + 40}px`,
            right: `${window.innerWidth - blobPosition.x - -30}px`,
            transform: 'translateY(-50%)',
          }}
        >
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={showOverlay ? undefined : placeholderText}
                disabled={isLoading}
                rows={1}
                className={clsx(
                  'bg-transparent border-0 outline-none',
                  'text-2xl font-bold tracking-wide',
                  'placeholder:text-gray-400',
                  'min-w-[200px] max-w-[350px]',
                  'resize-none overflow-y-auto',
                  'transition-all duration-200',
                  'leading-relaxed',
                  'prompt-bar-textarea',
                  isLoading && 'opacity-50 cursor-not-allowed animate-pulse'
                )}
                style={{ 
                  color: 'var(--dark-brown-color)',
                  caretColor: 'var(--dark-brown-color)',
                  maxHeight: '200px' 
                }}
              />
              {showOverlay && (
                <div
                  className={clsx(
                    'absolute inset-0 pointer-events-none',
                    'text-2xl font-bold tracking-wide',
                    'leading-relaxed',
                    'whitespace-pre-wrap',
                    'overflow-hidden'
                  )}
                  style={{
                    color: 'rgba(47, 42, 34, 0.6)',
                  }}
                >
                  {animatedPlaceholderText}
                </div>
              )}
            </div>
            
            {error && (
              <div 
                className="absolute top-full mt-3 left-0 px-4 py-2 rounded-lg bg-red-500/90 backdrop-blur-sm text-white text-base whitespace-nowrap shadow-lg"
                style={{
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)',
                }}
              >
                {error}
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}

