'use client';

import { useState } from 'react';
import { AppComponentProps } from '@/lib/types';

export default function NotepadApp({ windowId, initialData }: AppComponentProps) {
  const [content, setContent] = useState(initialData?.content || '');

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: 'var(--dark-brown-surface)' }}>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Start typing..."
        className="flex-1 w-full resize-none outline-none"
        style={{ 
          minHeight: 0,
          background: 'transparent',
          color: 'var(--dark-brown-text)',
          fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          lineHeight: '1.8',
          border: 'none',
          padding: '16px',
          fontSize: '18px',
          letterSpacing: '0.01em',
        }}
      />
    </div>
  );
}

