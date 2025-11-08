export type PinnedAppConfig = {
  appId: string;
  defaultPosition: {
    x: number;
    y: number;
  };
};

export const pinnedApps: PinnedAppConfig[] = [
  {
    appId: 'notepad',
    defaultPosition: { x: 32, y: 32 },
  },
  {
    appId: 'terminal',
    defaultPosition: { x: 120, y: 32 },
  },
];
