import React from 'react';

export type AppComponentProps = {
  windowId: string;
  initialData?: any;
};

export type AppDefinition = {
  appId: string;
  title: string;
  icon?: React.ReactNode;
  component: React.ComponentType<AppComponentProps>;
};

export type WindowStatus = 'normal' | 'minimized' | 'maximized';

export type WindowState = {
  id: string;
  appId: string;
  title: string;
  status: WindowStatus;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  data?: any;
};

