'use client';

import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { AppComponentProps } from '@/lib/types';

/**
 * IframeHTMLApp renders AI-generated HTML in an isolated iframe.
 * This provides complete isolation from the host page, preventing:
 * - Global document pollution
 * - Style conflicts
 * - Script conflicts
 * - Container remount issues
 * 
 * Use this as an alternative to HTMLApp for problematic apps.
 */
export default function IframeHTMLApp({ windowId, initialData }: AppComponentProps) {
  const html = initialData?.html || '';

  // Sanitize HTML for iframe
  const sanitizedHTML = useMemo(() => {
    if (!html) return '';
    
    // DOMPurify sanitization for iframe
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'button', 'input', 'form', 'label', 'select', 'option', 'textarea', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre', 'script', 'canvas', 'svg', 'style'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'style', 'width', 'height', 'type', 'value', 'name', 'placeholder', 'onclick', 'onchange', 'oninput', 'onsubmit', 'onkeypress', 'onkeydown', 'onkeyup', 'onfocus', 'onblur', 'onload', 'readonly', 'checked', 'disabled'],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
    });
    
    return sanitized;
  }, [html]);

  // Wrap HTML in a complete document structure for iframe
  const fullHTMLDocument = useMemo(() => {
    if (!sanitizedHTML) return '';
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: 100%;
      height: 100%;
      overflow: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
  </style>
</head>
<body>
  ${sanitizedHTML}
</body>
</html>`;
  }, [sanitizedHTML]);

  return (
    <div className="w-full h-full overflow-hidden" style={{ background: 'var(--dark-brown-surface)' }}>
      <iframe
        srcDoc={fullHTMLDocument}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        className="w-full h-full border-0"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
        title={`AI Generated App - ${windowId}`}
      />
    </div>
  );
}

