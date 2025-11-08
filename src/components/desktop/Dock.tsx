'use client';

import { ReactNode } from 'react';
import clsx from 'clsx';
import { FileText } from 'lucide-react';
import { pinnedApps } from '@/lib/pinnedApps';
import { useAppRegistry } from '@/lib/useAppRegistry';
import { useWindowActions, useWindows } from '@/lib/useWindowActions';
import type { WindowState } from '@/lib/types';

type DockEntry = {
  appId: string;
  title: string;
  icon?: ReactNode;
  window?: WindowState;
};

export default function Dock() {
  const windows = useWindows();
  const { focusWindow, restoreWindow } = useWindowActions();
  const { getApp, openAppWindow } = useAppRegistry();

  const runningWindowMap = new Map(windows.map((win) => [win.appId, win]));
  const pinnedAppIds = new Set(pinnedApps.map(({ appId }) => appId));

  const pinnedEntries = pinnedApps.reduce<DockEntry[]>((entries, { appId }) => {
    const app = getApp(appId);
    if (!app) {
      return entries;
    }

    entries.push({
      appId,
      title: app.title,
      icon: app.icon,
      window: runningWindowMap.get(appId),
    });

    return entries;
  }, []);

  const extraRunningEntries: DockEntry[] = windows
    .filter((win) => !pinnedAppIds.has(win.appId))
    .map((win) => {
      const app = getApp(win.appId);
      return {
        appId: win.appId,
        title: app?.title ?? win.title,
        icon: app?.icon,
        window: win,
      };
    });

  const dockEntries = [...pinnedEntries, ...extraRunningEntries];

  if (dockEntries.length === 0) {
    return null;
  }

  const handleAppClick = (appId: string) => {
    const existingWindow = runningWindowMap.get(appId);

    if (existingWindow) {
      if (existingWindow.status === 'minimized') {
        restoreWindow(existingWindow.id);
      }
      focusWindow(existingWindow.id);
    } else {
      openAppWindow(appId);
    }
  };

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[100] flex flex-col gap-2">
      {dockEntries.map(({ appId, title, icon, window }) => (
        <button
          key={appId}
          onClick={() => handleAppClick(appId)}
          className={clsx(
            'neu-button w-12 h-12 flex items-center justify-center p-0',
            window?.status === 'minimized' && 'opacity-60'
          )}
          aria-label={title}
          style={{ color: 'var(--neu-text)' }}
        >
          <span style={{ color: 'var(--neu-text)' }}>{icon || <FileText size={20} />}</span>
        </button>
      ))}
    </div>
  );
}
