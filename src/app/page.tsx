'use client';

import '@/apps/manifest';

import Desktop from '@/components/desktop/Desktop';
import DesktopIcon from '@/components/desktop/DesktopIcon';
import TerminalIcon from '@/components/desktop/TerminalIcon';
import Dock from '@/components/desktop/Dock';
import PromptBar from '@/components/desktop/PromptBar';
import { registerApp } from '@/lib/appRegistry';
import NotepadApp from '@/apps/notepad/NotepadApp';
import { FileText } from 'lucide-react';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Register the Notepad app
    registerApp({
      appId: 'notepad',
      title: 'Notepad',
      icon: <FileText size={20} />,
      component: NotepadApp,
    });
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="absolute inset-0">
        <Desktop />
      </div>
      <DesktopIcon />
      <TerminalIcon />
      <PromptBar />
      <Dock />
    </div>
  );
}
