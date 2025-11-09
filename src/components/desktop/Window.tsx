'use client';

import { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { X, Minus, Maximize2, Square } from 'lucide-react';
import { useWindowActions } from '@/lib/useWindowActions';
import { WindowState } from '@/lib/types';
import { useAppRegistry } from '@/lib/useAppRegistry';
import clsx from 'clsx';

const VELOCITY_PX_PER_S = 1200;
const COOLDOWN_MS = 1200;
const DRAG_WARN_PREFIX = '[DRAG_WARN] ';

const DRAG_WARNING_MESSAGES = [
  'Hey! Stop dragging me around!',
  'Easy there! I\'m getting dizzy.',
  'Careful! I\'m sensitive to sudden moves.',
  '(╯°□°）╯︵ ┻━┻'
];

interface WindowProps {
  window: WindowState;
}

export default function Window({ window: windowState }: WindowProps) {
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  
  const { getApp } = useAppRegistry();
  const {
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    updateWindowData,
  } = useWindowActions();

  const app = getApp(windowState.appId);
  if (!app) return null;

  const AppComponent = app.component;
  const isMaximized = windowState.status === 'maximized';
  const isMinimized = windowState.status === 'minimized';

  const dragStateRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastWarningRef = useRef<number>(0);
  const warningIndexRef = useRef<number>(0);

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
    if (!isMaximized && windowState.appId === 'terminal') {
      dragStateRef.current = { x: windowState.position.x, y: windowState.position.y, t: performance.now() };
    }
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

  const handleKeyDownCapture = (e: React.KeyboardEvent) => {
    const isArrowKey =
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight';
    if (!isArrowKey) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName.toLowerCase();
    const isFormField =
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      target.isContentEditable === true;
    if (isFormField) return;
    e.preventDefault();
  };

  const handleDrag = (_e: unknown, d: { x: number; y: number }) => {
    if (isMaximized || windowState.appId !== 'terminal') {
      return;
    }

    const now = performance.now();
    const prev = dragStateRef.current;

    if (prev) {
      const dx = d.x - prev.x;
      const dy = d.y - prev.y;
      const dt = (now - prev.t) / 1000;
      
      if (dt > 0) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = distance / dt;

        if (velocity >= VELOCITY_PX_PER_S) {
          const timeSinceLastWarning = now - lastWarningRef.current;
          
          if (timeSinceLastWarning >= COOLDOWN_MS) {
            const message = DRAG_WARNING_MESSAGES[warningIndexRef.current];
            warningIndexRef.current = (warningIndexRef.current + 1) % DRAG_WARNING_MESSAGES.length;
            lastWarningRef.current = now;
            
            if (message === '(╯°□°）╯︵ ┻━┻') {
              try {
                const audio = new Audio('/graphic_emoji_reply.mp3');
                audio.play().catch((error) => {
                  console.debug('Could not play graphic emoji reply sound:', error);
                });
              } catch (error) {
                console.debug('Could not create audio for graphic emoji reply sound:', error);
              }
            }
            
            updateWindowData(windowState.id, {
              aiInjectText: DRAG_WARN_PREFIX + message,
            });
          }
        }
      }
    }

    dragStateRef.current = { x: d.x, y: d.y, t: now };
  };

  const handleDragStop = (_e: unknown, d: { x: number; y: number }) => {
    if (!isMaximized) {
      updateWindowPosition(windowState.id, { x: d.x, y: d.y });
    }
    dragStateRef.current = null;
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
      onDrag={handleDrag}
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
          {app.icon && windowState.appId !== 'terminal' && windowState.appId !== 'browser' && windowState.appId !== 'cookie-clicker' && !windowState.appId.startsWith('html-') && <span className="w-4 h-4">{app.icon}</span>}
          <span className="text-base font-medium" style={{ color: 'var(--neu-text)' }}>{windowState.title}</span>
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
        onKeyDownCapture={handleKeyDownCapture}
      >
        <AppComponent windowId={windowState.id} initialData={windowState.data} />
      </div>
    </Rnd>
  );
}
