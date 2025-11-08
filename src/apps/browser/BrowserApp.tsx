'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, Home, Loader2, AlertCircle, X } from 'lucide-react';
import { AppComponentProps } from '@/lib/types';
import { useWindowActions } from '@/lib/useWindowActions';

const HOME_URL = 'https://google.com';

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return HOME_URL;

  // Check if it's already a URL with protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Check if it looks like a domain (contains a dot and no spaces)
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return `https://${trimmed}`;
  }

  // Otherwise treat as search query
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

/**
 * Converts a URL to use the browser proxy API
 * This bypasses X-Frame-Options restrictions
 */
function getProxyUrl(url: string): string {
  // Skip proxy for data URLs and blob URLs
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  
  // Use proxy for all http/https URLs
  return `/api/browser-proxy?url=${encodeURIComponent(url)}`;
}

export default function BrowserApp({ windowId, initialData }: AppComponentProps) {
  const [currentUrl, setCurrentUrl] = useState<string>(initialData?.url || HOME_URL);
  const [history, setHistory] = useState<string[]>([initialData?.url || HOME_URL]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>(initialData?.url || HOME_URL);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [aiHtml, setAiHtml] = useState<string | null>(initialData?.aiHtml || null);
  const { updateWindowData } = useWindowActions();

  // Publish currentUrl to window data whenever it changes
  useEffect(() => {
    updateWindowData(windowId, { url: currentUrl });
  }, [currentUrl, windowId, updateWindowData]);

  // Sync aiHtml from initialData when it changes externally
  useEffect(() => {
    if (initialData && 'aiHtml' in initialData) {
      setAiHtml(initialData.aiHtml || null);
    }
  }, [initialData]);

  const go = (url: string) => {
    const normalizedUrl = normalizeUrl(url);
    setCurrentUrl(normalizedUrl);
    setInputValue(normalizedUrl);
    setIsLoading(true);
    setError(null);

    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(normalizedUrl);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const back = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const url = history[newIndex];
      setCurrentUrl(url);
      setInputValue(url);
      setHistoryIndex(newIndex);
      setIsLoading(true);
      setIframeKey((prev) => prev + 1);
    }
  };

  const forward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const url = history[newIndex];
      setCurrentUrl(url);
      setInputValue(url);
      setHistoryIndex(newIndex);
      setIsLoading(true);
      setIframeKey((prev) => prev + 1);
    }
  };

  const reload = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const home = () => {
    go(HOME_URL);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    go(inputValue);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
    
    // Try to extract the actual URL from the proxy URL if we're using proxy
    if (iframeRef.current?.src) {
      try {
        const proxyUrl = iframeRef.current.src;
        const urlMatch = proxyUrl.match(/[?&]url=([^&]+)/);
        if (urlMatch) {
          const decodedUrl = decodeURIComponent(urlMatch[1]);
          if (decodedUrl !== currentUrl) {
            setCurrentUrl(decodedUrl);
            setInputValue(decodedUrl);
            // Update history if this is a new navigation
            if (!history.includes(decodedUrl)) {
              const newHistory = history.slice(0, historyIndex + 1);
              newHistory.push(decodedUrl);
              setHistory(newHistory);
              setHistoryIndex(newHistory.length - 1);
            }
          }
        }
      } catch (e) {
        // Ignore errors parsing URL
      }
    }
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load page. The website may be blocking iframe embedding or there was a network error.');
  };

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;
  const isAiView = aiHtml !== null;

  const exitAiView = () => {
    setAiHtml(null);
    updateWindowData(windowId, { aiHtml: null });
  };

  // Wrap HTML in a complete document structure for iframe srcDoc
  const aiHtmlDocument = aiHtml ? `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: 100%;
      height: 100%;
      overflow: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
  </style>
</head>
<body>
  ${aiHtml}
</body>
</html>` : null;

  return (
    <div className="w-full h-full flex flex-col" style={{ background: 'var(--dark-brown-surface)' }}>
      {/* Top bar with controls and address bar */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          borderBottom: '1px solid var(--dark-brown-border)',
          background: 'var(--dark-brown-surface)',
        }}
      >
        {/* Navigation controls */}
        <div className="flex items-center gap-1">
          {isAiView && (
            <button
              onClick={exitAiView}
              className="p-1.5 rounded transition-colors"
              style={{
                color: 'var(--dark-brown-text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--dark-brown-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Exit AI View"
              title="Exit AI View"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={back}
            disabled={!canGoBack || isAiView}
            className="p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              color: 'var(--dark-brown-text)',
            }}
            onMouseEnter={(e) => {
              if (canGoBack) {
                e.currentTarget.style.backgroundColor = 'var(--dark-brown-accent)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Back"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={forward}
            disabled={!canGoForward || isAiView}
            className="p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              color: 'var(--dark-brown-text)',
            }}
            onMouseEnter={(e) => {
              if (canGoForward) {
                e.currentTarget.style.backgroundColor = 'var(--dark-brown-accent)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Forward"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={reload}
            disabled={isAiView}
            className="p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              color: 'var(--dark-brown-text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dark-brown-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Reload"
          >
            <RotateCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={home}
            disabled={isAiView}
            className="p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              color: 'var(--dark-brown-text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dark-brown-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Home"
          >
            <Home size={16} />
          </button>
        </div>

        {/* Address bar */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center">
          <input
            type="text"
            value={isAiView ? 'AI Generated View' : inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isAiView}
            className="flex-1 px-3 py-1.5 rounded outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'var(--dark-brown-accent)',
              border: '1px solid var(--dark-brown-border)',
              color: 'var(--dark-brown-text)',
              fontSize: '13px',
            }}
            onFocus={(e) => {
              if (!isAiView) {
                e.currentTarget.style.borderColor = 'var(--beige-accent)';
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--dark-brown-border)';
            }}
            placeholder={isAiView ? 'AI Generated View' : 'Enter URL or search...'}
          />
        </form>

        {/* Loading indicator */}
        {isLoading && (
          <div className="ml-2">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--dark-brown-text)' }} />
          </div>
        )}
      </div>

      {/* Browser content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {error && (
          <div
            className="absolute inset-0 flex items-center justify-center p-8 z-10"
            style={{ background: 'var(--dark-brown-surface)' }}
          >
            <div
              className="max-w-md p-6 rounded-lg border"
              style={{
                background: 'var(--dark-brown-accent)',
                borderColor: 'var(--dark-brown-border)',
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  size={24}
                  style={{ color: 'var(--beige-accent)', flexShrink: 0, marginTop: '2px' }}
                />
                <div className="flex-1">
                  <h3
                    className="font-semibold mb-2"
                    style={{ color: 'var(--dark-brown-text)' }}
                  >
                    Unable to Load Page
                  </h3>
                  <p
                    className="text-sm mb-4"
                    style={{ color: 'var(--dark-brown-text)' }}
                  >
                    {error}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={reload}
                      className="px-4 py-2 rounded text-sm transition-colors"
                      style={{
                        background: 'var(--beige-accent)',
                        color: 'var(--dark-brown-text)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => {
                        setError(null);
                        window.open(currentUrl, '_blank');
                      }}
                      className="px-4 py-2 rounded text-sm transition-colors"
                      style={{
                        border: '1px solid var(--dark-brown-border)',
                        color: 'var(--dark-brown-text)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--dark-brown-accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Open in New Tab
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {isAiView && aiHtmlDocument ? (
          <iframe
            key={`ai-${iframeKey}`}
            ref={iframeRef}
            srcDoc={aiHtmlDocument}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="AI Generated View"
          />
        ) : (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={getProxyUrl(currentUrl)}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title={`Browser - ${currentUrl}`}
          />
        )}
      </div>
    </div>
  );
}

