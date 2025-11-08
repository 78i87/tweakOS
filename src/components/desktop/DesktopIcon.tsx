'use client';

import { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { useWindowActions, useWindows } from '@/lib/useWindowActions';
import { getApp, openAppWindow, subscribeToApps } from '@/lib/appRegistry';
import { FileText } from 'lucide-react';

export default function DesktopIcon() {
  const windows = useWindows();
  const { focusWindow, restoreWindow } = useWindowActions();
  const [app, setApp] = useState(() => getApp('notepad'));
  const [position, setPosition] = useState({ x: 32, y: 32 });
  const didDragRef = useRef(false);
  const dragStartPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const unsubscribe = subscribeToApps(() => {
      setApp(getApp('notepad'));
    });
    return unsubscribe;
  }, []);

  const notepadWindow = windows.find((w) => w.appId === 'notepad');

  if (!app) {
    return null;
  }

  const handleClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (notepadWindow) {
      if (notepadWindow.status === 'minimized') {
        restoreWindow(notepadWindow.id);
      }
      focusWindow(notepadWindow.id);
    } else {
      openAppWindow('notepad');
    }
  };

  const handleDragStart = () => {
    dragStartPositionRef.current = { ...position };
    didDragRef.current = false;
  };

  const handleDragStop = (_e: unknown, d: { x: number; y: number }) => {
    const moved = Math.abs(d.x - dragStartPositionRef.current.x) > 5 || 
                  Math.abs(d.y - dragStartPositionRef.current.y) > 5;
    
    if (moved) {
      didDragRef.current = true;
      setPosition({ x: d.x, y: d.y });
      setTimeout(() => {
        didDragRef.current = false;
      }, 100);
    } else {
      didDragRef.current = false;
    }
  };

  return (
    <Rnd
      position={position}
      onDragStart={handleDragStart}
      onDragStop={handleDragStop}
      enableResizing={false}
      bounds="window"
      style={{ position: 'absolute' }}
    >
      <button
        onClick={handleClick}
        className="flex flex-col items-center gap-1 p-2 rounded transition-colors hover:bg-white/10 active:bg-white/5 cursor-move"
        aria-label="Notepad"
      >
        <div className="w-16 h-16 flex items-center justify-center text-[#2F2A22]">
          <FileText size={40} />
        </div>
        <span className="text-xs text-[#2F2A22] font-medium" style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
          Notepad
        </span>
      </button>
    </Rnd>
  );
}
