'use client';

import { useState } from 'react';
import { AppComponentProps } from '@/lib/types';

export default function NotepadApp({ windowId, initialData }: AppComponentProps) {
  const [content, setContent] = useState(initialData?.content || '');

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Start typing..."
        className="flex-1 w-full p-4 resize-none outline-none bg-transparent text-sm font-mono"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}

