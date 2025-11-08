'use client';

import { useWindowStore } from './windowStore';

export function useWindowActions() {
  const openWindow = useWindowStore((state) => state.openWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const minimizeWindow = useWindowStore((state) => state.minimizeWindow);
  const maximizeWindow = useWindowStore((state) => state.maximizeWindow);
  const restoreWindow = useWindowStore((state) => state.restoreWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const updateWindowPosition = useWindowStore(
    (state) => state.updateWindowPosition
  );
  const updateWindowSize = useWindowStore((state) => state.updateWindowSize);
  const updateWindowData = useWindowStore((state) => state.updateWindowData);

  return {
    openWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    updateWindowData,
  };
}

export function useWindows() {
  return useWindowStore((state) => state.windows);
}
