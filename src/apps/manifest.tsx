'use client';

import { registerApp } from '@/lib/appRegistry';
import type { AppDefinition } from '@/lib/types';
import NotepadApp from './notepad/NotepadApp';

const defaultApps: AppDefinition[] = [
  {
    appId: 'notepad',
    title: 'Notepad',
    component: NotepadApp,
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
