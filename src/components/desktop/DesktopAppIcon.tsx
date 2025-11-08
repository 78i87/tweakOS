'use client';

import React, { useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { FileText } from 'lucide-react';
import { useWindowActions, useWindows } from '@/lib/useWindowActions';
import { useAppRegistry } from '@/lib/useAppRegistry';

type DesktopAppIconProps = {
  appId: string;
  defaultPosition: { x: number; y: number };
};

export default function DesktopAppIcon({
  appId,
  defaultPosition,
}: DesktopAppIconProps) {
  const windows = useWindows();
  const { focusWindow, restoreWindow } = useWindowActions();
  const { getApp, openAppWindow } = useAppRegistry();
  const app = getApp(appId);

  const [position, setPosition] = useState(defaultPosition);
  const didDragRef = useRef(false);
  const dragStartPositionRef = useRef(defaultPosition);

  if (!app) {
    return null;
  }

  const existingWindow = windows.find((w) => w.appId === appId);

  const handleClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    if (existingWindow) {
      if (existingWindow.status === 'minimized') {
        restoreWindow(existingWindow.id);
      }
      focusWindow(existingWindow.id);
    } else {
      openAppWindow(appId);
    }
  };

  const handleDragStart = () => {
    dragStartPositionRef.current = { ...position };
    didDragRef.current = false;
  };

  const handleDragStop = (_e: unknown, d: { x: number; y: number }) => {
    const moved =
      Math.abs(d.x - dragStartPositionRef.current.x) > 5 ||
      Math.abs(d.y - dragStartPositionRef.current.y) > 5;

    if (moved) {
      didDragRef.current = true;
      setPosition({ x: d.x, y: d.y });
      setTimeout(() => {
        didDragRef.current = false;
      }, 100);
    } else {
      didDragRef.current = false;
    }
  };

  const iconSize = 40;
  const iconNode = (() => {
    if (React.isValidElement(app.icon)) {
      return React.cloneElement(app.icon, { size: iconSize });
    }
    if (app.icon) {
      return app.icon;
    }
    return <FileText size={iconSize} />;
  })();

  return (
    <Rnd
      position={position}
      onDragStart={handleDragStart}
      onDragStop={handleDragStop}
      enableResizing={false}
      bounds="window"
      style={{ position: 'absolute' }}
    >
      <button
        onClick={handleClick}
        className="flex flex-col items-center gap-1 p-2 rounded transition-colors hover:bg-white/10 active:bg-white/5 cursor-move"
        aria-label={app.title}
      >
        <div className="w-16 h-16 flex items-center justify-center text-[#2F2A22]">
          {iconNode}
        </div>
        <span
          className="text-xs text-[#2F2A22] font-medium"
          style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}
        >
          {app.title}
        </span>
      </button>
    </Rnd>
  );
}
