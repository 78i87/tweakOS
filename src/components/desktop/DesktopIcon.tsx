'use client';

import { useState, useEffect } from 'react';
import { useWindowActions, useWindows } from '@/lib/useWindowActions';
import { getApp, openAppWindow, subscribeToApps } from '@/lib/appRegistry';
import { FileText } from 'lucide-react';

export default function DesktopIcon() {
  const windows = useWindows();
  const { focusWindow, restoreWindow } = useWindowActions();
  const [app, setApp] = useState(() => getApp('notepad'));

  // Subscribe to app registry changes to re-render when app is registered
  useEffect(() => {
    const unsubscribe = subscribeToApps(() => {
      setApp(getApp('notepad'));
    });
    return unsubscribe;
  }, []);

  // Check if Notepad window exists
  const notepadWindow = windows.find((w) => w.appId === 'notepad');

  // Only show if Notepad app is registered
  if (!app) {
    return null;
  }

  const handleClick = () => {
    if (notepadWindow) {
      // Window exists - focus/restore it
      if (notepadWindow.status === 'minimized') {
        restoreWindow(notepadWindow.id);
      }
      focusWindow(notepadWindow.id);
    } else {
      // Window doesn't exist - open it
      openAppWindow('notepad');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="absolute top-4 left-4 flex flex-col items-center gap-1 p-2 rounded transition-colors hover:bg-white/10 active:bg-white/5"
      aria-label="Notepad"
    >
      <div className="w-12 h-12 flex items-center justify-center text-[#2F2A22]">
        <FileText size={32} />
      </div>
      <span className="text-xs text-[#2F2A22] font-medium" style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
        Notepad
      </span>
    </button>
  );
}
