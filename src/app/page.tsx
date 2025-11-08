'use client';

import { useState, useEffect } from 'react';
import '@/apps/manifest';

import Desktop from '@/components/desktop/Desktop';
import DesktopIcons from '@/components/desktop/DesktopIcons';
import Dock from '@/components/desktop/Dock';
import PromptBar from '@/components/desktop/PromptBar';
import { useAppRegistry } from '@/lib/useAppRegistry';
import { useWindowActions, useWindows } from '@/lib/useWindowActions';
import { TerminalSquare } from 'lucide-react';

export default function Home() {
  const [showIntro, setShowIntro] = useState(false);
  const [showDesktopUI, setShowDesktopUI] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [terminalWindowCentered, setTerminalWindowCentered] = useState(false);
  const { openAppWindow } = useAppRegistry();
  const { updateWindowPosition, updateWindowSize } = useWindowActions();
  const windows = useWindows();

  useEffect(() => {
    // Check if intro has been seen before
    const introSeen = localStorage.getItem('introSeen');
    if (!introSeen) {
      setShowIntro(true);
    } else {
      setShowDesktopUI(true);
    }
  }, []);

  useEffect(() => {
    // Find terminal window opened from intro and center it (only once)
    if (showIntro && !introComplete && !terminalWindowCentered) {
      const terminalWindow = windows.find(
        (w) => w.appId === 'terminal' && w.data?.fromIntro
      );
      if (terminalWindow) {
        // Center window: 820x560 at center of screen
        const centerX = (window.innerWidth - 820) / 2;
        const centerY = (window.innerHeight - 560) / 2;
        updateWindowSize(terminalWindow.id, { width: 820, height: 560 });
        updateWindowPosition(terminalWindow.id, { x: centerX, y: centerY });
        setTerminalWindowCentered(true);
      }
    }
  }, [windows, showIntro, introComplete, terminalWindowCentered, updateWindowPosition, updateWindowSize]);

  const handleTerminalIconClick = () => {
    // Open terminal with callback
    openAppWindow('terminal', {
      fromIntro: true,
      onStartupComplete: () => {
        // Wait 4 seconds after script completion
        setTimeout(() => {
          setIntroComplete(true);
          setShowIntro(false);
          setShowDesktopUI(true);
          localStorage.setItem('introSeen', 'true');
        }, 4000);
      },
    });
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="absolute inset-0">
        <Desktop />
      </div>
      {showDesktopUI && (
        <>
          <DesktopIcons />
          <PromptBar />
          <Dock />
        </>
      )}
      {showIntro && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'var(--dark-brown-surface)', zIndex: 0 }}
        >
          <button
            onClick={handleTerminalIconClick}
            className="flex flex-col items-center gap-4 p-6 rounded-lg transition-opacity hover:opacity-80 active:opacity-60 cursor-pointer"
            aria-label="Terminal"
          >
            <div className="w-24 h-24 flex items-center justify-center" style={{ color: 'var(--dark-brown-text)' }}>
              <TerminalSquare size={96} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
