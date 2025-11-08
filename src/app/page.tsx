'use client';

import '@/apps/manifest';

import Desktop from '@/components/desktop/Desktop';
import DesktopIcons from '@/components/desktop/DesktopIcons';
import Dock from '@/components/desktop/Dock';
import PromptBar from '@/components/desktop/PromptBar';

export default function Home() {
  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="absolute inset-0">
        <Desktop />
      </div>
      <DesktopIcons />
      <PromptBar />
      <Dock />
    </div>
  );
}
