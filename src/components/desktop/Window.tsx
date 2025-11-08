'use client';

import { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { X, Minus, Maximize2, Square } from 'lucide-react';
import { useWindowActions } from '@/lib/useWindowActions';
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
  } = useWindowActions();

  const app = getApp(windowState.appId);
  if (!app) return null;

  const AppComponent = app.component;
  const isMaximized = windowState.status === 'maximized';
  const isMinimized = windowState.status === 'minimized';

  useEffect(() => {
    const updateSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
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

  const handleDragStop = (_e: unknown, d: { x: number; y: number }) => {
    if (!isMaximized) {
      updateWindowPosition(windowState.id, { x: d.x, y: d.y });
    }
  };

  const handleResizeStop = (
    _e: unknown,
    _direction: unknown,
    ref: HTMLElement,
    _delta: unknown,
    position: { x: number; y: number }
  ) => {
    if (!isMaximized) {
      updateWindowSize(windowState.id, {
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
      updateWindowPosition(windowState.id, position);
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
      onDragStart={handleFocus}
      onResizeStart={handleFocus}
      minWidth={300}
      minHeight={200}
      enableResizing={!isMaximized}
      disableDragging={isMaximized}
      dragHandleClassName="window-drag-handle"
      bounds="window"
      resizeHandleComponent={{
        top: <div className="window-resize-handle n" />,
        right: <div className="window-resize-handle e" />,
        bottom: <div className="window-resize-handle s" />,
        left: <div className="window-resize-handle w" />,
        topRight: <div className="window-resize-handle ne" />,
        bottomRight: <div className="window-resize-handle se" />,
        bottomLeft: <div className="window-resize-handle sw" />,
        topLeft: <div className="window-resize-handle nw" />,
      }}
      style={{
        zIndex: windowState.zIndex,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        borderRadius: isMaximized ? '0' : '16px',
      }}
      className={clsx('neu-surface', isMaximized && 'fixed inset-0')}
    >
      <div
        className="window-drag-handle flex items-center justify-between px-4 py-2 cursor-move select-none"
        style={{ 
          minHeight: '40px', 
          background: 'var(--neu-surface)', 
          borderBottom: '1px solid var(--dark-brown-border)',
          borderTopLeftRadius: isMaximized ? '0' : '16px',
          borderTopRightRadius: isMaximized ? '0' : '16px',
          color: 'var(--neu-text)'
        }}
        onDoubleClick={handleMaximize}
      >
        <div className="flex items-center gap-2" style={{ paddingLeft: '12px' }}>
          {app.icon && <span className="w-4 h-4">{app.icon}</span>}
          <span className="text-sm font-medium" style={{ color: 'var(--neu-text)' }}>{windowState.title}</span>
        </div>
        <div className="flex items-center gap-1.5" style={{ marginRight: '12px' }}>
          <button
            onClick={handleMaximize}
            className="macos-window-control macos-control-maximize"
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Square size={6} /> : <Maximize2 size={6} />}
          </button>
          <button
            onClick={handleMinimize}
            className="macos-window-control macos-control-minimize"
            aria-label="Minimize"
          >
            <Minus size={8} />
          </button>
          <button
            onClick={handleClose}
            className="macos-window-control macos-control-close"
            aria-label="Close"
          >
            <X size={8} />
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-hidden"
        style={{
          borderBottomLeftRadius: isMaximized ? '0' : '16px',
          borderBottomRightRadius: isMaximized ? '0' : '16px',
        }}
      >
        <AppComponent windowId={windowState.id} initialData={windowState.data} />
      </div>
    </Rnd>
  );
}
