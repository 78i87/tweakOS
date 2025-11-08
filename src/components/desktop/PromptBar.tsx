'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { getAIAgentService } from '@/lib/aiAgent';
import { makeAppFromHTML } from '@/lib/appRegistry';
import clsx from 'clsx';
import './blob-indicator.css';

export default function PromptBar() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input when hovered
    if (isHovered && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isHovered]);

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
    // Keep hovered state true during loading so panel stays visible
    setIsHovered(true);

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
        
        // Clear prompt on success and hide panel
        setPrompt('');
        setIsHovered(false);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Show panel if hovered or if loading (to preserve prompt during processing)
  const shouldShowPanel = isHovered || isLoading;

  return (
    <>
      {/* Large invisible hover zone in bottom-right corner */}
      <div 
        className="fixed bottom-0 right-0 w-32 h-32 z-[89]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          // Don't hide if loading (preserve prompt during processing)
          if (!isLoading) {
            setIsHovered(false);
          }
        }}
      />
      
      {/* Main container */}
      <div 
        ref={containerRef}
        className="fixed bottom-6 right-6 z-[90]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          // Don't hide if loading (preserve prompt during processing)
          if (!isLoading) {
            setIsHovered(false);
          }
        }}
      >
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

        {/* Blob indicator - always visible when hovered */}
        {isHovered && (
          <div className={clsx(
            'blob-indicator absolute bottom-0 right-0 w-20 h-20 pointer-events-none',
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
        )}
        
        {/* Prompt panel - slides in from right toward center */}
        <div
          className={clsx(
            'transition-all duration-300 ease-out',
            shouldShowPanel 
              ? 'translate-x-0 opacity-100' 
              : 'translate-x-[calc(100%+1.5rem)] opacity-0 pointer-events-none'
          )}
        >
        <form onSubmit={handleSubmit} className="relative">
          <div className="neu-surface-inset px-6 py-4 flex items-center gap-4 bg-opacity-90 backdrop-blur-sm" style={{ backgroundColor: 'rgba(224, 229, 236, 0.85)' }}>
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter a prompt to generate a custom app..."
              disabled={isLoading}
              className={clsx(
                'flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-gray-400',
                'text-base md:text-lg w-96 py-2',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className={clsx(
                'neu-button p-3 flex items-center justify-center',
                'transition-all duration-200',
                (!prompt.trim() || isLoading) && 'opacity-50 cursor-not-allowed',
                'hover:scale-105 active:scale-95'
              )}
              aria-label="Generate app"
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin text-gray-600" />
              ) : (
                <Send size={20} className="text-gray-600" />
              )}
            </button>
          </div>
          
          {error && shouldShowPanel && (
            <div className="mt-2 neu-surface px-3 py-2 flex items-center gap-2 text-sm text-red-600 bg-opacity-90" style={{ backgroundColor: 'rgba(224, 229, 236, 0.85)' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </form>
        </div>
      </div>
    </>
  );
}

