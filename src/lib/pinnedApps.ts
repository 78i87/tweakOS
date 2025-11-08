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
    defaultPosition: { x: 160, y: 32 },
  },
  {
    appId: 'browser',
    defaultPosition: { x: 288, y: 32 },
  },
];
