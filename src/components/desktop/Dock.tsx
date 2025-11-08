'use client';

import { useState, useEffect } from 'react';
import { useWindowActions, useWindows } from '@/lib/useWindowActions';
import { getAllApps, openAppWindow, subscribeToApps, getApp } from '@/lib/appRegistry';
import { FileText } from 'lucide-react';
import clsx from 'clsx';

export default function Dock() {
  const windows = useWindows();
  const { focusWindow, restoreWindow } = useWindowActions();
  const [apps, setApps] = useState(() => getAllApps());

  useEffect(() => {
    const unsubscribe = subscribeToApps(() => {
      setApps(getAllApps());
    });
    return unsubscribe;
  }, []);

  const handleAppClick = (appId: string) => {
    const runningWindow = windows.find((w) => w.appId === appId && w.status === 'minimized');
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

  if (apps.length === 0 && windows.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-6 bottom-24 z-[100]">
      <div className="neu-surface px-2 py-4 flex flex-col items-center gap-2">
        {/* App Launchers */}
        {apps.map((app) => {
          const isRunning = windows.some((w) => w.appId === app.appId);
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
        {windows.length > 0 && (
          <>
            {apps.length > 0 && <div className="h-px w-8 bg-gray-300 my-1" />}
            {windows.map((window) => {
              const app = getApp(window.appId);
              return (
                <button
                  key={window.id}
                  onClick={() => handleWindowClick(window.id, window.status)}
                  className={clsx(
                    'neu-button w-12 h-12 flex items-center justify-center p-0',
                    window.status === 'minimized' && 'opacity-60'
                  )}
                  aria-label={window.title}
                >
                  {app?.icon || <FileText size={20} />}
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
