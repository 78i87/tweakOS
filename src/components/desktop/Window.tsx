'use client';

import { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { X, Minus, Maximize2, Square } from 'lucide-react';
import { useWindowStore } from '@/lib/windowStore';
import { WindowState } from '@/lib/types';
import { getApp } from '@/lib/appRegistry';
import clsx from 'clsx';

interface WindowProps {
  window: WindowState;
}

export default function Window({ window: windowState }: WindowProps) {
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  
  const {
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
  } = useWindowStore();

  const app = getApp(windowState.appId);
  if (!app) return null;

  const AppComponent = app.component;
  const isMaximized = windowState.status === 'maximized';
  const isMinimized = windowState.status === 'minimized';

  useEffect(() => {
    const updateSize = () => {
      if (typeof window !== 'undefined') {
        setViewportSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
    };
    updateSize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, []);

  const handleFocus = () => {
    focusWindow(windowState.id);
  };

  const handleMinimize = () => {
    minimizeWindow(windowState.id);
  };

  const handleMaximize = () => {
    if (isMaximized) {
      restoreWindow(windowState.id);
    } else {
      maximizeWindow(windowState.id);
    }
  };

  const handleClose = () => {
    closeWindow(windowState.id);
  };

  const handleDragStop = (_e: any, d: { x: number; y: number }) => {
    if (!isMaximized) {
      updateWindowPosition(windowState.id, { x: d.x, y: d.y });
    }
  };

  const handleResizeStop = (_e: any, _direction: any, ref: HTMLElement) => {
    if (!isMaximized) {
      updateWindowSize(windowState.id, {
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
    }
  };

  if (isMinimized) {
    return null;
  }

  const maximizedSize = viewportSize.width > 0 && viewportSize.height > 0
    ? { width: viewportSize.width, height: viewportSize.height }
    : windowState.size;

  return (
    <Rnd
      size={isMaximized ? maximizedSize : windowState.size}
      position={isMaximized ? { x: 0, y: 0 } : windowState.position}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      minWidth={300}
      minHeight={200}
      enableResizing={!isMaximized}
      disableDragging={isMaximized}
      style={{
        zIndex: windowState.zIndex,
        display: 'flex',
        flexDirection: 'column',
      }}
      className={clsx('neu-surface', isMaximized && 'fixed inset-0')}
      onMouseDown={handleFocus}
    >
      {/* Window Title Bar */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-move select-none"
        style={{ minHeight: '40px' }}
        onDoubleClick={handleMaximize}
      >
        <div className="flex items-center gap-2">
          {app.icon && <span className="w-4 h-4">{app.icon}</span>}
          <span className="text-sm font-medium">{windowState.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="neu-button w-6 h-6 flex items-center justify-center p-0"
            aria-label="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleMaximize}
            className="neu-button w-6 h-6 flex items-center justify-center p-0"
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Square size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={handleClose}
            className="neu-button w-6 h-6 flex items-center justify-center p-0"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-hidden neu-surface-inset" style={{ margin: '8px', borderRadius: '12px' }}>
        <AppComponent windowId={windowState.id} initialData={windowState.data} />
      </div>
    </Rnd>
  );
}

