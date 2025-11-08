'use client';

import { useWindows } from '@/lib/useWindowActions';
import Window from './Window';

export default function Desktop() {
  const windows = useWindows();

  return (
    <div 
      className="relative w-full h-full overflow-hidden"
      style={{
        backgroundImage: 'url(/wallpaper.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {windows.map((win) => (
        <Window key={win.id} window={win} />
      ))}
    </div>
  );
}
