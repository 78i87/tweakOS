'use client';

import { FileText } from 'lucide-react';
import { registerApp } from '@/lib/appRegistry';
import type { AppDefinition } from '@/lib/types';
import NotepadApp from './notepad/NotepadApp';

const defaultApps: AppDefinition[] = [
  {
    appId: 'notepad',
    title: 'Notepad',
    icon: <FileText size={20} />,
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
