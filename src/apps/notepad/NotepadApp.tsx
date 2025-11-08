'use client';

import { useState } from 'react';
import { AppComponentProps } from '@/lib/types';

export default function NotepadApp({ windowId, initialData }: AppComponentProps) {
  const [content, setContent] = useState(initialData?.content || '');

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: 'var(--beige-surface)' }}>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Start typing..."
        className="flex-1 w-full p-4 resize-none outline-none text-sm"
        style={{ 
          minHeight: 0,
          background: 'transparent',
          color: 'var(--beige-text)',
          fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          lineHeight: '1.6',
          border: 'none',
        }}
      />
    </div>
  );
}

