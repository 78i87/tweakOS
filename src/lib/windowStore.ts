import { create } from 'zustand';
import { WindowState, WindowStatus } from './types';

interface WindowStore {
  windows: WindowState[];
  nextZIndex: number;
  openWindow: (appId: string, title: string, data?: any) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: { x: number; y: number }) => void;
  updateWindowSize: (id: string, size: { width: number; height: number }) => void;
  updateWindowStatus: (id: string, status: WindowStatus) => void;
  updateWindowData: (id: string, data: any) => void;
}

const defaultWindowSize = { width: 900, height: 600 };
const defaultPosition = { x: 100, y: 100 };

export const useWindowStore = create<WindowStore>((set) => ({
  windows: [],
  nextZIndex: 1,

  openWindow: (appId: string, title: string, data?: any) => {
    set((state) => {
      const newWindow: WindowState = {
        id: `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        appId,
        title,
        status: 'normal',
        position: {
          x: defaultPosition.x + (state.windows.length * 30),
          y: defaultPosition.y + (state.windows.length * 30),
        },
        size: defaultWindowSize,
        zIndex: state.nextZIndex,
        data,
      };
      return {
        windows: [...state.windows, newWindow],
        nextZIndex: state.nextZIndex + 1,
      };
    });
  },

  closeWindow: (id: string) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== id),
    }));
  },

  minimizeWindow: (id: string) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, status: 'minimized' as WindowStatus } : w
      ),
    }));
  },

  maximizeWindow: (id: string) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, status: 'maximized' as WindowStatus } : w
      ),
    }));
  },

  restoreWindow: (id: string) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, status: 'normal' as WindowStatus } : w
      ),
    }));
  },

  focusWindow: (id: string) => {
    set((state) => {
      const maxZIndex = Math.max(...state.windows.map((w) => w.zIndex), 0);
      // Ensure focused window appears above intro overlay (z-index 1000)
      const newZIndex = Math.max(maxZIndex + 1, 1001);
      return {
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, zIndex: newZIndex } : w
        ),
        nextZIndex: newZIndex + 1,
      };
    });
  },

  updateWindowPosition: (id: string, position: { x: number; y: number }) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, position } : w
      ),
    }));
  },

  updateWindowSize: (id: string, size: { width: number; height: number }) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, size } : w
      ),
    }));
  },

  updateWindowStatus: (id: string, status: WindowStatus) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, status } : w
      ),
    }));
  },

  updateWindowData: (id: string, data: any) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, data: { ...w.data, ...data } } : w
      ),
    }));
  },
}));

