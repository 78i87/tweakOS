'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppDefinition } from './types';
import {
  getAllApps,
  getApp as getRegisteredApp,
  openAppWindow as registryOpenAppWindow,
  subscribeToApps,
} from './appRegistry';

export function useAppRegistry() {
  const [apps, setApps] = useState<AppDefinition[]>(() => getAllApps());

  useEffect(() => {
    const unsubscribe = subscribeToApps(() => {
      setApps(getAllApps());
    });
    return unsubscribe;
  }, []);

  const appMap = useMemo(() => {
    return new Map(apps.map((app) => [app.appId, app]));
  }, [apps]);

  const getApp = useCallback(
    (appId: string) => {
      return appMap.get(appId) ?? getRegisteredApp(appId);
    },
    [appMap]
  );

  const openAppWindow = useCallback(
    (appId: string, data?: any) => registryOpenAppWindow(appId, data),
    []
  );

  return {
    apps,
    getApp,
    openAppWindow,
  };
}
