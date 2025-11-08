'use client';

import { useState, useEffect, useRef } from 'react';
import { AppComponentProps } from '@/lib/types';
import { executeCommand } from './terminalCore';
import { initVfs } from './vfs';

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
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startupRanRef = useRef(false);
  const startupCompleteCallbackRanRef = useRef(false);

  useEffect(() => {
    // Guard against double execution in Strict Mode
    if (startupRanRef.current) return;
    startupRanRef.current = true;

    // Initialize VFS
    initVfs();
    
    // Startup sequence
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

  const handleCommand = (cmd: string, isAI: boolean = false) => {
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
            output: [`"${cmd}"? Not a valid command. Is it a concept?`],
            timestamp: Date.now(),
            isAIText: true,
            typingText: `"${cmd}"? Not a valid command. Is it a concept?`,
          },
        ]);
        
        setTimeout(() => {
          setHistory((prev) => [
            ...prev,
            {
              command: '',
              output: ['G. U. I. ... Define it.'],
              timestamp: Date.now(),
              isAIText: true,
              typingText: 'G. U. I. ... Define it.',
            },
          ]);
          // After GUI prompt, show permanent input
          setTimeout(() => {
            setShowInlineInput(true);
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);
          }, 'G. U. I. ... Define it.'.length * 15 + 500);
        }, 1000);
      }, 500);
      setInput('');
      return;
    }

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
    if (!isAI) {
      setInput('');
      // Keep inline input visible after command execution
      if (!showInlineInput) {
        setShowInlineInput(true);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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
      <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-sm" style={{ color: 'var(--dark-brown-text)' }}>
        {history.map((entry, idx) => (
          <div key={idx} className="mb-2">
            {entry.isAIText ? (
              // AI text messages (no command prompt) - with typewriter effect
              <div className="whitespace-pre-wrap">
                {entry.output.map((line, lineIdx) => (
                  <div key={lineIdx}>
                    {entry.typingText && entry.typingText === line ? (
                      <TypewriterText text={line} speed={15} />
                    ) : (
                      line
                    )}
                  </div>
                ))}
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
