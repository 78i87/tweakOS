'use client';

import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { AppComponentProps } from '@/lib/types';

export default function HTMLApp({ windowId, initialData }: AppComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = initialData?.html || '';

  useEffect(() => {
    if (containerRef.current && html) {
      // Sanitize and inject HTML
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'button', 'input', 'form', 'label', 'select', 'option', 'textarea', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'style', 'width', 'height', 'type', 'value', 'name', 'placeholder'],
      });
      containerRef.current.innerHTML = sanitized;
    }
  }, [html]);

  return (
    <div className="w-full h-full overflow-auto p-4">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

