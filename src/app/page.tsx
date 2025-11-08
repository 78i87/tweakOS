'use client';

import '@/apps/manifest';

import Desktop from '@/components/desktop/Desktop';
import DesktopIcon from '@/components/desktop/DesktopIcon';
import Dock from '@/components/desktop/Dock';

export default function Home() {
  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="absolute inset-0">
        <Desktop />
      </div>
      <DesktopIcon />
      <Dock />
    </div>
  );
}
