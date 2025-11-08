'use client';

import { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { getAIAgentService } from '@/lib/aiAgent';
import { makeAppFromHTML } from '@/lib/appRegistry';
import clsx from 'clsx';
import './blob-indicator.css';

export default function PromptBar() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [blobPosition, setBlobPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const dragStartPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Focus input when modal opens
    if (isModalOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isModalOpen]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt, isModalOpen]);

  // Set initial blob position client-side after mount to avoid hydration mismatch
  useEffect(() => {
    setBlobPosition({
      x: window.innerWidth - 80 - 24, // blob width (80px) + right margin (24px)
      y: window.innerHeight - 80 - 24, // blob height (80px) + bottom margin (24px)
    });
  }, []);

  // Update blob position on window resize to keep it in bottom-right
  useEffect(() => {
    const handleResize = () => {
      // Only update if blob is near the bottom-right (within 50px)
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

  // Handle click outside to close prompt bar
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

    const startTime = Date.now();
    console.log('[PROMPT BAR] ===== Starting app generation =====');
    console.log('[PROMPT BAR] Prompt:', prompt);

    setIsLoading(true);
    setError(null);
    // Keep modal open during loading so prompt stays visible
    setIsModalOpen(true);

    try {
      const serviceStart = Date.now();
      console.log('[PROMPT BAR] Getting AI service...');
      const aiService = await getAIAgentService();
      console.log('[PROMPT BAR] AI service obtained in', Date.now() - serviceStart, 'ms');
      
      const generateStart = Date.now();
      console.log('[PROMPT BAR] Generating app from prompt...');
      const result = await aiService.generateAppFromPrompt(prompt);
      console.log('[PROMPT BAR] Generation completed in', Date.now() - generateStart, 'ms');
      console.log('[PROMPT BAR] Result:', {
        success: result.success,
        hasData: !!(result.success && result.data),
        title: result.success ? result.data.title : undefined,
        htmlLength: result.success ? result.data.html.length : undefined,
      });

      if (result.success) {
        const appStart = Date.now();
        console.log('[PROMPT BAR] Creating app from HTML...');
        console.log('[PROMPT BAR] Title:', result.data.title);
        console.log('[PROMPT BAR] HTML length:', result.data.html.length);
        console.log('[PROMPT BAR] HTML preview (first 300 chars):', result.data.html.substring(0, 300));
        
        // Create app from generated HTML
        makeAppFromHTML({
          title: result.data.title,
          html: result.data.html,
        });
        
        console.log('[PROMPT BAR] App created in', Date.now() - appStart, 'ms');
        
        const totalTime = Date.now() - startTime;
        console.log(`[PROMPT BAR] Total time: ${totalTime}ms`);
        console.log('[PROMPT BAR] ===== App generation completed =====');
        
        // Clear prompt on success and close modal
        setPrompt('');
        setIsModalOpen(false);
      } else {
        console.error('[PROMPT BAR] Generation failed:', result.error);
        setError(result.error);
      }
    } catch (err) {
      const totalTime = Date.now() - startTime;
      console.error('[PROMPT BAR] Error after', totalTime, 'ms:', err);
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

  const handleDoubleClick = () => {
    // Don't open modal if user just dragged
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setIsModalOpen(true);
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

  const handleCloseModal = () => {
    if (!isLoading) {
      setIsModalOpen(false);
      setError(null);
    }
  };

  return (
    <>
      {/* SVG filter for goo effect */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
          </filter>
        </defs>
      </svg>

      {/* Blob indicator - always visible, draggable */}
      <Rnd
        position={blobPosition}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        enableResizing={false}
        bounds="window"
        style={{ position: 'absolute' }}
      >
        <div 
          ref={containerRef}
          className="cursor-move z-[90]"
          onDoubleClick={handleDoubleClick}
        >
          <div className={clsx(
            'blob-indicator w-20 h-20',
            isLoading && 'blob-thinking'
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

      {/* Minimal Caret-Only Prompt Bar - centered with blob */}
      {isModalOpen && (
        <div
          ref={modalRef}
          className="fixed z-[100] transition-all duration-300 ease-out"
          style={{
            top: `${blobPosition.y + 40}px`, // blob center (blob is 80px tall, so center is y + 40)
            right: `${window.innerWidth - blobPosition.x - 80}px`,
            transform: 'translateY(-50%)', // Center vertically
          }}
        >
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Let's make something"
              disabled={isLoading}
              rows={1}
              className={clsx(
                'bg-transparent border-0 outline-none',
                'text-gray-900 text-xl font-bold tracking-wide',
                'placeholder:text-gray-900',
                'min-w-[400px] max-w-[600px]',
                'caret-gray-900',
                'resize-none overflow-y-auto',
                'transition-all duration-200',
                'leading-relaxed',
                'prompt-bar-textarea',
                isLoading && 'opacity-50 cursor-not-allowed animate-pulse'
              )}
              style={{ maxHeight: '200px' }}
            />
            
            {error && (
              <div 
                className="absolute top-full mt-3 left-0 px-4 py-2 rounded-lg bg-red-500/90 backdrop-blur-sm text-white text-sm whitespace-nowrap shadow-lg"
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

