'use client';

import { useEffect } from 'react';
import Desktop from '@/components/desktop/Desktop';
import TopBar from '@/components/desktop/TopBar';
import Dock from '@/components/desktop/Dock';
import { registerApp } from '@/lib/appRegistry';
import NotepadApp from '@/apps/notepad/NotepadApp';
import { FileText } from 'lucide-react';

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
      <TopBar />
      <div className="absolute inset-0" style={{ paddingTop: '48px', paddingBottom: '80px' }}>
        <Desktop />
      </div>
      <Dock />
    </div>
  );
}
