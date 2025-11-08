'use client';

import { useWindowActions, useWindows } from '@/lib/useWindowActions';
import { getApp } from '@/lib/appRegistry';
import { FileText } from 'lucide-react';
import clsx from 'clsx';

export default function Dock() {
  const windows = useWindows();
  const { focusWindow, restoreWindow } = useWindowActions();

  const runningWindows = windows;

  const handleWindowClick = (windowId: string, status: string) => {
    if (status === 'minimized') {
      restoreWindow(windowId);
      focusWindow(windowId);
    } else {
      focusWindow(windowId);
    }
  };

  // Deduplicate windows by appId, keeping the first one for each app
  const uniqueRunningApps = Array.from(
    new Map(runningWindows.map((w) => [w.appId, w])).values()
  );

  if (uniqueRunningApps.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex gap-2">
      {uniqueRunningApps.map((win) => {
        const app = getApp(win.appId);
        return (
          <button
            key={win.id}
            onClick={() => handleWindowClick(win.id, win.status)}
            className={clsx(
              'neu-button w-12 h-12 flex items-center justify-center p-0',
              win.status === 'minimized' && 'opacity-60'
            )}
            aria-label={win.title}
          >
            {app?.icon || <FileText size={20} />}
          </button>
        );
      })}
    </div>
  );
}
