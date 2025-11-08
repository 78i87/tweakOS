'use client';

import { useMemo, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { AppComponentProps } from '@/lib/types';

/**
 * Extracts <style> tags from HTML using DOM parsing and returns both the styles and cleaned HTML
 */
function extractStyles(html: string): { styles: string[]; cleanedHtml: string } {
  const styles: string[] = [];
  
  if (!html || typeof html !== 'string') {
    return { styles, cleanedHtml: html || '' };
  }
  
  try {
    // Create a temporary DOM element to parse the HTML as actual DOM elements
    const tempDiv = document.createElement('div');
    
    // Set innerHTML to parse the HTML string into actual DOM elements
    tempDiv.innerHTML = html;
    
    // Find all style tags using DOM querySelector (parses as actual elements)
    const styleTags = tempDiv.querySelectorAll('style');
    
    // Extract style content from each style tag
    styleTags.forEach((styleTag) => {
      // Use textContent first (more reliable), fallback to innerHTML
      const styleContent = styleTag.textContent || styleTag.innerHTML || '';
      if (styleContent.trim()) {
        styles.push(styleContent.trim());
      }
      // Remove the style tag from the DOM
      styleTag.remove();
    });
    
    // Get the cleaned HTML without style tags (as string)
    const cleanedHtml = tempDiv.innerHTML;
    
    return { styles, cleanedHtml };
  } catch (error) {
    console.error('[HTMLApp] Error extracting styles:', error);
    // If DOM parsing fails, return original HTML without styles
    return { styles, cleanedHtml: html };
  }
}

/**
 * Fixes common CSS syntax issues before parsing, particularly missing semicolons
 */
function fixCSSSyntax(css: string): string {
  if (!css || typeof css !== 'string') {
    return css;
  }

  let fixed = css;
  
  // Store comments temporarily to preserve them
  const comments: string[] = [];
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    comments.push(match);
    return `__COMMENT_${comments.length - 1}__`;
  });
  
  // Fix missing semicolons before closing braces
  // Pattern: property: value followed by whitespace/newlines and then }
  // This matches declarations like "color: red }" and fixes to "color: red; }"
  fixed = fixed.replace(/([a-zA-Z-][a-zA-Z0-9_-]*)\s*:\s*([^:;{}]+?)(\s*)(})/g, (match, prop, value, whitespace, brace) => {
    // Don't add semicolon if it already ends with one
    const trimmedValue = value.trim();
    if (trimmedValue.endsWith(';')) {
      return match;
    }
    // Don't add semicolon if value contains unmatched braces (like in calc(), url(), etc.)
    const openBraces = (trimmedValue.match(/\(/g) || []).length;
    const closeBraces = (trimmedValue.match(/\)/g) || []).length;
    if (openBraces !== closeBraces) {
      return match; // Likely a function call, don't modify
    }
    return `${prop}: ${trimmedValue};${whitespace}${brace}`;
  });
  
  // Fix missing semicolons between property declarations
  // Pattern: property: value followed by newline/whitespace and another property
  fixed = fixed.replace(/([a-zA-Z-][a-zA-Z0-9_-]*)\s*:\s*([^:;{}]+?)(\s+)([a-zA-Z-][a-zA-Z0-9_-]*\s*:)/g, (match, prop1, value1, whitespace, prop2) => {
    const trimmedValue = value1.trim();
    if (trimmedValue.endsWith(';')) {
      return match;
    }
    // Check for function calls
    const openBraces = (trimmedValue.match(/\(/g) || []).length;
    const closeBraces = (trimmedValue.match(/\)/g) || []).length;
    if (openBraces !== closeBraces) {
      return match;
    }
    return `${prop1}: ${trimmedValue};${whitespace}${prop2}`;
  });

  // Restore comments
  comments.forEach((comment, index) => {
    fixed = fixed.replace(`__COMMENT_${index}__`, comment);
  });

  return fixed;
}

function scopeSelector(selector: string, containerClass: string): string {
  const processor = selectorParser((selectors) => {
    selectors.each((sel) => {
      let hasContainerClass = false;

      sel.walkClasses((classNode) => {
        if (classNode.value === containerClass) {
          hasContainerClass = true;
        }
      });

      if (hasContainerClass) {
        return;
      }

      // Allow developers to opt out using :global()
      sel.walkPseudos((pseudo) => {
        if (pseudo.value === ':global' && pseudo.nodes && pseudo.nodes.length > 0) {
          const globalSelector = pseudo.nodes[0];
          if (globalSelector) {
            const clonedNodes = globalSelector.nodes.map((node) => node.clone());
            pseudo.replaceWith(...clonedNodes);
          } else {
            pseudo.remove();
          }
        }
      });

      // Remove global tags that would escape the container
      sel.walkTags((tagNode) => {
        if (tagNode.value === 'html' || tagNode.value === 'body') {
          tagNode.remove();
        }
      });

      sel.walkPseudos((pseudo) => {
        if (pseudo.value === ':root') {
          pseudo.remove();
        }
      });

      // Clean up leading combinators without targets
      while (sel.nodes.length && sel.nodes[0].type === 'combinator' && sel.nodes[0].value.trim() === '') {
        sel.nodes.shift();
      }

      if (sel.nodes.length === 0) {
        sel.append(selectorParser.className({ value: containerClass }));
        return;
      }

      const containerNode = selectorParser.className({ value: containerClass });
      const combinatorNode = selectorParser.combinator({ value: ' ' });

      sel.prepend(combinatorNode);
      sel.prepend(containerNode);
    });
  });

  try {
    return processor.processSync(selector);
  } catch (error) {
    console.error('[HTMLApp] Failed to scope selector:', selector, error);
    return `.${containerClass} ${selector}`;
  }
}

function scopeStylesForContainer(styles: string[], containerClass: string): string[] {
  if (!styles || styles.length === 0) {
    return [];
  }

  const sanitizedContainerRaw = containerClass.startsWith('.') ? containerClass.slice(1) : containerClass;
  const sanitizedContainer = sanitizedContainerRaw || 'html-app';

  return styles.map((styleBlock) => {
    if (!styleBlock || !styleBlock.trim()) {
      return styleBlock;
    }

    try {
      // Fix common CSS syntax issues before parsing
      const fixedCSS = fixCSSSyntax(styleBlock);
      
      // Try parsing with PostCSS
      const root = postcss.parse(fixedCSS, { from: undefined });

      root.walkRules((rule) => {
        if (!rule.selector) {
          return;
        }

        const parent = rule.parent;
        if (parent && parent.type === 'atrule') {
          const atRuleName = (parent as any).name as string | undefined;
          if (atRuleName === 'keyframes') {
            // Keyframe selectors (from, to, 0%) should not be scoped
            return;
          }
        }

        let selectors: string[];
        try {
          selectors = (rule as any).selectors as string[];
        } catch {
          return;
        }

        if (!Array.isArray(selectors)) {
          return;
        }

        (rule as any).selectors = selectors.map((selector) => scopeSelector(selector, sanitizedContainer));
      });

      return root.toString();
    } catch (error) {
      console.error('[HTMLApp] Failed to scope styles. Error:', error);
      console.error('[HTMLApp] Problematic CSS (first 500 chars):', styleBlock.substring(0, 500));
      
      // If parsing fails, try to return the fixed CSS without scoping as fallback
      try {
        const fixedCSS = fixCSSSyntax(styleBlock);
        return fixedCSS;
      } catch (fixError) {
        console.error('[HTMLApp] Failed to fix CSS syntax:', fixError);
        // Last resort: return original (might have issues but won't crash)
        return styleBlock;
      }
    }
  });
}

export default function HTMLApp({ windowId, initialData }: AppComponentProps) {
  const html = initialData?.html || '';
  const styleElementRefs = useRef<HTMLStyleElement[]>([]);

  const containerClass = useMemo(() => {
    const baseId = typeof windowId === 'string' ? windowId : String(windowId ?? 'window');
    const normalized = baseId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return normalized ? `html-app-${normalized}` : 'html-app';
  }, [windowId]);

  // Extract styles and sanitize HTML
  const { sanitizedHTML, extractedStyles } = useMemo(() => {
    if (!html) return { sanitizedHTML: '', extractedStyles: [] };
    
    // Extract styles BEFORE sanitization to preserve them
    const { styles, cleanedHtml } = extractStyles(html);
    
    // Use DOMPurify to sanitize the cleaned HTML (without style tags)
    const sanitized = DOMPurify.sanitize(cleanedHtml, {
      ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'button', 'input', 'form', 'label', 'select', 'option', 'textarea', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre', 'script'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'style', 'width', 'height', 'type', 'value', 'name', 'placeholder', 'onclick', 'onchange', 'oninput', 'onsubmit', 'onkeypress', 'onkeydown', 'onkeyup', 'onfocus', 'onblur', 'onload', 'readonly', 'checked', 'disabled'],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
    });
    
    return { sanitizedHTML: sanitized, extractedStyles: styles };
  }, [html]);

  const scopedStyles = useMemo(() => scopeStylesForContainer(extractedStyles, containerClass), [extractedStyles, containerClass]);

  // Inject scoped styles into document head
  useEffect(() => {
    const styleId = `html-app-styles-${containerClass}`;

    const removeExistingStyles = () => {
      const existingStyles = document.querySelectorAll(`style[data-app-id="${styleId}"]`);
      existingStyles.forEach((style) => style.remove());
      styleElementRefs.current = [];
    };

    // Always clear any previous styles for this window before injecting new ones
    removeExistingStyles();

    if (scopedStyles.length === 0) {
      console.log(`[HTMLApp] No scoped styles to inject for container ${containerClass}`);
      return removeExistingStyles;
    }

    console.log(`[HTMLApp] Injecting ${scopedStyles.length} scoped style block(s) for ${containerClass}`);

    scopedStyles.forEach((styleContent, index) => {
      if (!styleContent || !styleContent.trim()) {
        console.warn(`[HTMLApp] Skipping empty scoped style block at index ${index}`);
        return;
      }

      const styleElement = document.createElement('style');
      styleElement.setAttribute('data-app-id', styleId);
      styleElement.setAttribute('data-container-class', containerClass);
      styleElement.setAttribute('data-style-index', index.toString());
      styleElement.type = 'text/css';
      styleElement.textContent = styleContent;

      document.head.appendChild(styleElement);
      styleElementRefs.current.push(styleElement);

      console.log(`[HTMLApp] Injected scoped style block ${index + 1}/${scopedStyles.length} (length: ${styleContent.length})`);
    });

    // Cleanup function: remove injected styles when component unmounts or dependencies change
    return removeExistingStyles;
  }, [scopedStyles, containerClass]);

  return (
    <div className="w-full h-full overflow-auto p-4">
      <div
        className={`w-full h-full ${containerClass}`}
        data-container-class={containerClass}
        dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      />
    </div>
  );
}

