'use client';

import { useState, useEffect } from 'react';
import { useWindowStore } from '@/lib/windowStore';
import { getAllApps, openAppWindow, subscribeToApps } from '@/lib/appRegistry';
import { FileText } from 'lucide-react';
import clsx from 'clsx';

export default function Dock() {
  const windows = useWindowStore((state) => state.windows);
  const minimizeWindow = useWindowStore((state) => state.minimizeWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const restoreWindow = useWindowStore((state) => state.restoreWindow);
  
  const [apps, setApps] = useState(() => getAllApps());

  useEffect(() => {
    const unsubscribe = subscribeToApps(() => {
      setApps(getAllApps());
    });
    return unsubscribe;
  }, []);

  const runningWindows = windows;

  const handleAppClick = (appId: string) => {
    const runningWindow = runningWindows.find((w) => w.appId === appId && w.status === 'minimized');
    if (runningWindow) {
      restoreWindow(runningWindow.id);
      focusWindow(runningWindow.id);
    } else {
      openAppWindow(appId);
    }
  };

  const handleWindowClick = (windowId: string, status: string) => {
    if (status === 'minimized') {
      restoreWindow(windowId);
      focusWindow(windowId);
    } else {
      focusWindow(windowId);
    }
  };

  if (apps.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[100]">
      <div className="neu-surface px-4 py-2 flex items-center gap-2">
        {/* App Launchers */}
        {apps.map((app) => {
          const isRunning = runningWindows.some((w) => w.appId === app.appId);
          return (
            <button
              key={app.appId}
              onClick={() => handleAppClick(app.appId)}
              className={clsx(
                'neu-button w-12 h-12 flex items-center justify-center p-0',
                isRunning && 'ring-2 ring-blue-400'
              )}
              aria-label={`Open ${app.title}`}
            >
              {app.icon || <FileText size={20} />}
            </button>
          );
        })}

        {/* Running Windows */}
        {runningWindows.length > 0 && (
          <>
            <div className="w-px h-8 bg-gray-300 mx-1" />
            {runningWindows.map((window) => (
              <button
                key={window.id}
                onClick={() => handleWindowClick(window.id, window.status)}
                className={clsx(
                  'neu-button w-12 h-12 flex items-center justify-center p-0',
                  window.status === 'minimized' && 'opacity-60'
                )}
                aria-label={window.title}
              >
                <FileText size={20} />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
