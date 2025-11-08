'use client';

import { registerApp } from '@/lib/appRegistry';
import type { AppDefinition } from '@/lib/types';
import NotepadApp from './notepad/NotepadApp';
import TerminalApp from './terminal/TerminalApp';
import BrowserApp from './browser/BrowserApp';
import CookieClickerApp from './cookie-clicker/CookieClickerApp';
import { TerminalSquare, Globe, Cookie } from 'lucide-react';

const defaultApps: AppDefinition[] = [
  {
    appId: 'notepad',
    title: 'Notepad',
    component: NotepadApp,
  },
  {
    appId: 'terminal',
    title: 'Terminal',
    icon: <TerminalSquare size={28} />,
    component: TerminalApp,
  },
  {
    appId: 'browser',
    title: 'Browser',
    icon: <Globe size={28} />,
    component: BrowserApp,
  },
  {
    appId: 'cookie-clicker',
    title: 'Cookie Clicker',
    icon: <Cookie size={28} />,
    component: CookieClickerApp,
  },
];

let initialized = false;

export function ensureDefaultAppsRegistered() {
  if (initialized) {
    return;
  }
  defaultApps.forEach(registerApp);
  initialized = true;
}

ensureDefaultAppsRegistered();

export { defaultApps };
