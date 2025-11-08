'use client';

import DesktopAppIcon from './DesktopAppIcon';
import { pinnedApps } from '@/lib/pinnedApps';

export default function DesktopIcons() {
  return (
    <>
      {pinnedApps.map(({ appId, defaultPosition }) => (
        <DesktopAppIcon
          key={appId}
          appId={appId}
          defaultPosition={defaultPosition}
        />
      ))}
    </>
  );
}
