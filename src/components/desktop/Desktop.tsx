'use client';

import { useWindowStore } from '@/lib/windowStore';
import Window from './Window';

export default function Desktop() {
  const windows = useWindowStore((state) => state.windows);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {windows.map((win) => (
        <Window key={win.id} window={win} />
      ))}
    </div>
  );
}

