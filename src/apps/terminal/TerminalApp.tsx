'use client';

import { useState, useEffect, useRef } from 'react';
import { AppComponentProps } from '@/lib/types';
import { executeCommand } from './terminalCore';
import { initVfs } from './vfs';
import { TerminalSquare, Send } from 'lucide-react';

type HistoryEntry = {
  command: string;
  output: string[];
  timestamp: number;
};

export default function TerminalApp({ windowId }: AppComponentProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cwd, setCwd] = useState('/sandbox');
  const [agentMessages, setAgentMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [agentInput, setAgentInput] = useState('');
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const agentEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize VFS
    initVfs();
    // Initial welcome message
    setHistory([{
      command: '',
      output: ['Welcome to Terminal. Type "help" for available commands.'],
      timestamp: Date.now(),
    }]);
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    agentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  const handleCommand = (cmd: string) => {
    if (!cmd.trim()) return;

    const result = executeCommand(cmd, cwd);
    
    if (result.clear) {
      setHistory([]);
    } else {
      setHistory((prev) => [
        ...prev,
        {
          command: cmd,
          output: result.output,
          timestamp: Date.now(),
        },
      ]);
    }

    setCwd(result.cwd);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommand(input);
    }
  };

  const runCommand = (cmd: string) => {
    setInput(cmd);
    setTimeout(() => {
      handleCommand(cmd);
    }, 50);
  };

  const handleAgentSubmit = async () => {
    if (!agentInput.trim() || isAgentLoading) return;

    const userMessage = agentInput.trim();
    setAgentInput('');
    setIsAgentLoading(true);

    const newMessages = [...agentMessages, { role: 'user' as const, content: userMessage }];
    setAgentMessages(newMessages);

    try {
      // Get terminal context
      const recentHistory = history.slice(-50).map((h) => h.command).filter(Boolean);
      const { getVFS } = await import('./vfs');
      const vfs = getVFS();
      const fsSnapshot = vfs.getSnapshot('/sandbox', 100, 120);

      const response = await fetch('/api/cliAgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: {
            cwd,
            history: recentHistory,
            fs: fsSnapshot,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get agent response');
      }

      const data = await response.json();
      setAgentMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setAgentMessages([
        ...newMessages,
        { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      ]);
    } finally {
      setIsAgentLoading(false);
    }
  };

  const extractCommands = (text: string): string[] => {
    const lines = text.split('\n');
    const commands: string[] = [];
    let inCommandsSection = false;

    for (const line of lines) {
      if (line.trim().toLowerCase().startsWith('commands:')) {
        inCommandsSection = true;
        continue;
      }
      if (inCommandsSection) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
          commands.push(trimmed);
        }
        // Stop if we hit another section or empty line after commands
        if (trimmed === '' && commands.length > 0) {
          break;
        }
      }
    }

    return commands;
  };

  return (
    <div className="w-full h-full flex min-h-0" style={{ background: 'var(--dark-brown-surface)' }}>
      {/* Terminal - 70% */}
      <div className="flex-[7] min-w-0 min-h-0 flex flex-col border-r" style={{ borderColor: 'var(--dark-brown-border)' }}>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-sm" style={{ color: 'var(--dark-brown-text)' }}>
          {history.map((entry, idx) => (
            <div key={idx} className="mb-2">
              {entry.command && (
                <div className="mb-1">
                  <span style={{ color: '#7BB3FF' }}>$</span>{' '}
                  <span>{entry.command}</span>
                </div>
              )}
              {entry.output.length > 0 && (
                <div className="ml-4 whitespace-pre-wrap">
                  {entry.output.map((line, lineIdx) => (
                    <div key={lineIdx}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
        <div className="border-t p-2 flex items-center gap-2" style={{ borderColor: 'var(--dark-brown-border)' }}>
          <span style={{ color: '#7BB3FF' }}>$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none"
            style={{ color: 'var(--dark-brown-text)' }}
            placeholder="Enter command..."
            autoFocus
          />
        </div>
      </div>

      {/* Agent - 30% */}
      <div className="flex-[3] min-w-0 min-h-0 flex flex-col">
        <div className="border-b p-3 flex items-center gap-2" style={{ borderColor: 'var(--dark-brown-border)' }}>
          <TerminalSquare size={16} style={{ color: 'var(--dark-brown-text)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--dark-brown-text)' }}>
            CLI Agent
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {agentMessages.length === 0 && (
            <div className="text-sm opacity-60" style={{ color: 'var(--dark-brown-text)' }}>
              Ask me about your terminal or filesystem. I can suggest commands.
            </div>
          )}
          {agentMessages.map((msg, idx) => (
            <div key={idx} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div
                className={`inline-block p-2 rounded text-sm max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.role === 'assistant' && (
                  <div className="mt-2 space-y-1">
                    {extractCommands(msg.content).map((cmd, cmdIdx) => (
                      <div key={cmdIdx} className="flex gap-1 items-center">
                        <code className="flex-1 bg-gray-800 px-2 py-1 rounded text-xs font-mono text-gray-200">
                          {cmd}
                        </code>
                        <button
                          onClick={() => {
                            setInput(cmd);
                            inputRef.current?.focus();
                          }}
                          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Insert
                        </button>
                        <button
                          onClick={() => runCommand(cmd)}
                          className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          Run
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isAgentLoading && (
            <div className="text-sm opacity-60" style={{ color: 'var(--dark-brown-text)' }}>
              Thinking...
            </div>
          )}
          <div ref={agentEndRef} />
        </div>
        <div className="border-t p-2 flex gap-2" style={{ borderColor: 'var(--dark-brown-border)' }}>
          <input
            type="text"
            value={agentInput}
            onChange={(e) => setAgentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAgentSubmit();
              }
            }}
            className="flex-1 bg-transparent outline-none text-sm px-2 py-1 rounded"
            style={{ 
              color: 'var(--dark-brown-text)',
              border: '1px solid var(--dark-brown-border)'
            }}
            placeholder="Ask agent..."
            disabled={isAgentLoading}
          />
          <button
            onClick={handleAgentSubmit}
            disabled={!agentInput.trim() || isAgentLoading}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

