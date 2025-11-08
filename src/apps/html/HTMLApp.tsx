'use client';

import { useMemo, useEffect, useRef, memo } from 'react';
import DOMPurify from 'dompurify';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { AppComponentProps } from '@/lib/types';

/**
 * Creates a scoped document object that queries within a container first,
 * then falls back to the real document. This avoids mutating global document.
 * Uses Proxy to properly delegate all document properties while overriding query methods.
 */
function createScopedDocument(container: HTMLElement): Document {
  const realDocument = document;
  
  return new Proxy(realDocument, {
    get(target, prop) {
      // Override query methods to scope to container
      if (prop === 'getElementById') {
        return function(id: string) {
          const containerResult = container.querySelector('#' + id) as HTMLElement;
          return containerResult || realDocument.getElementById(id);
        };
      }
      if (prop === 'querySelector') {
        return function(selector: string) {
          const containerResult = container.querySelector(selector);
          return containerResult || realDocument.querySelector(selector);
        };
      }
      if (prop === 'querySelectorAll') {
        return function(selector: string) {
          const containerResults = container.querySelectorAll(selector);
          return containerResults.length > 0 ? containerResults : realDocument.querySelectorAll(selector);
        };
      }
      // Delegate all other properties to the real document
      const value = (target as any)[prop];
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  }) as Document;
}

/**
 * Extracts <style> tags from HTML using DOM parsing and returns both the styles and cleaned HTML
 */
function extractStyles(html: string): { styles: string[]; cleanedHtml: string } {
  const styles: string[] = [];
  
  if (!html || typeof html !== 'string') {
    return { styles, cleanedHtml: html || '' };
  }
  
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const styleTags = tempDiv.querySelectorAll('style');
    
    styleTags.forEach((styleTag) => {
      const styleContent = styleTag.textContent || styleTag.innerHTML || '';
      if (styleContent.trim()) {
        styles.push(styleContent.trim());
      }
      styleTag.remove();
    });
    
    const cleanedHtml = tempDiv.innerHTML;
    
    return { styles, cleanedHtml };
  } catch (error) {
    console.error('[HTMLApp] Error extracting styles:', error);
    return { styles, cleanedHtml: html };
  }
}

function extractScripts(html: string): { scripts: string[]; cleanedHtml: string } {
  const scripts: string[] = [];
  
  if (!html || typeof html !== 'string') {
    return { scripts, cleanedHtml: html || '' };
  }
  
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const scriptTags = tempDiv.querySelectorAll('script');
    
    scriptTags.forEach((scriptTag) => {
      if (scriptTag.hasAttribute('src')) {
        scriptTag.remove();
        return;
      }
      
      const scriptContent = scriptTag.textContent || scriptTag.innerHTML || '';
      if (scriptContent.trim()) {
        scripts.push(scriptContent.trim());
      }
      scriptTag.remove();
    });
    
    return { scripts, cleanedHtml: tempDiv.innerHTML };
  } catch (error) {
    console.error('[HTMLApp] Error extracting scripts:', error);
    return { scripts, cleanedHtml: html };
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

  return styles
    .map((styleBlock) => {
      if (!styleBlock || !styleBlock.trim()) {
        return null;
      }

      try {
        const fixedCSS = fixCSSSyntax(styleBlock);
        const root = postcss.parse(fixedCSS, { from: undefined });

        root.walkRules((rule) => {
          if (!rule.selector) {
            return;
          }

          const parent = rule.parent;
          if (parent && parent.type === 'atrule') {
            const atRuleName = parent.name;
            if (atRuleName === 'keyframes') {
              return;
            }
          }

          const selectors = rule.selectors;
          if (!Array.isArray(selectors)) {
            return;
          }

          rule.selectors = selectors.map((selector) => scopeSelector(selector, sanitizedContainer));
        });

        return root.toString();
      } catch (error) {
        console.error('[HTMLApp] Failed to scope styles:', error);
        try {
          return fixCSSSyntax(styleBlock);
        } catch {
          return null;
        }
      }
    })
    .filter((style): style is string => style !== null);
}

function HTMLApp({ windowId, initialData }: AppComponentProps) {
  const html = initialData?.html || '';
  const styleElementRefs = useRef<HTMLStyleElement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);
  const lastHtmlRef = useRef<string>('');
  const mountCountRef = useRef(0);

  const containerClass = useMemo(() => {
    const baseId = typeof windowId === 'string' ? windowId : String(windowId ?? 'window');
    const normalized = baseId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return normalized ? `html-app-${normalized}` : 'html-app';
  }, [windowId]);

  const { sanitizedHTML, extractedStyles, extractedScripts } = useMemo(() => {
    if (!html) return { sanitizedHTML: '', extractedStyles: [], extractedScripts: [] };
    
    const { styles, cleanedHtml: htmlAfterStyles } = extractStyles(html);
    const { scripts, cleanedHtml: htmlAfterScripts } = extractScripts(htmlAfterStyles);
    
    const sanitized = DOMPurify.sanitize(htmlAfterScripts, {
      ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'button', 'input', 'form', 'label', 'select', 'option', 'textarea', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 'code', 'pre', 'script', 'canvas', 'svg'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'id', 'style', 'width', 'height', 'type', 'value', 'name', 'placeholder', 'onclick', 'onchange', 'oninput', 'onsubmit', 'onkeypress', 'onkeydown', 'onkeyup', 'onfocus', 'onblur', 'onload', 'readonly', 'checked', 'disabled'],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
    });
    
    return { sanitizedHTML: sanitized, extractedStyles: styles, extractedScripts: scripts };
  }, [html]);

  const scopedStyles = useMemo(() => scopeStylesForContainer(extractedStyles, containerClass), [extractedStyles, containerClass]);

  // Instrumentation: Log mount/unmount and container ref changes
  useEffect(() => {
    mountCountRef.current += 1;
    const mountId = mountCountRef.current;
    console.log(`[HTMLApp] Mount #${mountId} for windowId: ${windowId}, containerClass: ${containerClass}`);
    
    return () => {
      console.log(`[HTMLApp] Unmount #${mountId} for windowId: ${windowId}, containerClass: ${containerClass}`);
    };
  }, [windowId, containerClass]);

  // Track container ref changes
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      console.log(`[HTMLApp] Container ref set for ${containerClass}, element:`, container);
      
      const observer = new MutationObserver((mutations) => {
        console.log(`[HTMLApp] Container DOM mutations detected for ${containerClass}:`, mutations.length);
      });
      
      observer.observe(container, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeOldValue: true 
      });
      
      return () => {
        observer.disconnect();
        console.log(`[HTMLApp] Container observer disconnected for ${containerClass}`);
      };
    }
  }, [containerClass]);

  // Inject scoped styles into document head
  useEffect(() => {
    const styleId = `html-app-styles-${containerClass}`;

    const removeExistingStyles = () => {
      const existingStyles = document.querySelectorAll(`style[data-app-id="${styleId}"]`);
      existingStyles.forEach((style) => style.remove());
      styleElementRefs.current = [];
    };

    removeExistingStyles();

    if (scopedStyles.length === 0) {
      return removeExistingStyles;
    }

    scopedStyles.forEach((styleContent, index) => {
      if (!styleContent || !styleContent.trim()) {
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
    });

    return removeExistingStyles;
  }, [scopedStyles, containerClass]);

  // Execute scripts with scoped document (no global overrides)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || extractedScripts.length === 0) {
      return;
    }

    // Reset initialization flag if HTML content changed
    if (lastHtmlRef.current !== html) {
      hasInitializedRef.current = false;
      lastHtmlRef.current = html;
      console.log(`[HTMLApp] HTML content changed for ${containerClass}, resetting initialization flag`);
    }

    // Guard against re-execution unless HTML changed
    if (hasInitializedRef.current) {
      console.log(`[HTMLApp] Scripts already initialized for ${containerClass}, skipping re-execution`);
      return;
    }

    // Wait for DOM to be ready using MutationObserver
    let scriptsScheduled = false;
    const executeScriptsWhenReady = () => {
      // Prevent multiple executions
      if (scriptsScheduled) {
        return true;
      }

      const currentContainer = containerRef.current;
      if (!currentContainer || !currentContainer.isConnected) {
        return false;
      }

      // Check if container has content
      if (!currentContainer.innerHTML.trim()) {
        return false;
      }

      scriptsScheduled = true;

      // Wait a bit more to ensure all elements are parsed and rendered
      requestAnimationFrame(() => {
        setTimeout(() => {
          const finalContainer = containerRef.current;
          if (!finalContainer || !finalContainer.isConnected || !finalContainer.innerHTML.trim()) {
            console.warn(`[HTMLApp] Container not ready after delay for ${containerClass}`);
            scriptsScheduled = false;
            return;
          }

          console.log(`[HTMLApp] Executing ${extractedScripts.length} script(s) for ${containerClass} using scoped document`);

          // Create scoped document for this container
          const scopedDoc = createScopedDocument(finalContainer);

          // Track successful script executions
          let successCount = 0;
          const totalScripts = extractedScripts.filter(s => s && s.trim()).length;

          // Execute each script with scoped document
          extractedScripts.forEach((scriptContent, index) => {
            if (!scriptContent || !scriptContent.trim()) {
              return;
            }

            try {
              // Pass scoped document, container, and other common globals
              const executeScript = new Function(
                'container',
                'containerClass',
                'document',
                'window',
                'console',
                scriptContent
              );
              executeScript(finalContainer, containerClass, scopedDoc, window, console);
              successCount++;
              console.log(`[HTMLApp] Successfully executed script ${index + 1}/${extractedScripts.length} for ${containerClass}`);
            } catch (error) {
              // Check if it's a null addEventListener error
              const errorMessage = error instanceof Error ? error.message : String(error);
              if (errorMessage.includes('null') && (errorMessage.includes('addEventListener') || errorMessage.includes('Cannot read properties'))) {
                console.warn(`[HTMLApp] Script ${index + 1} tried to access null element. Retrying after delay...`);
                // Retry after a longer delay to ensure DOM is ready
                setTimeout(() => {
                  try {
                    const retryContainer = containerRef.current;
                    if (retryContainer && retryContainer.isConnected && retryContainer.innerHTML.trim()) {
                      const retryScopedDoc = createScopedDocument(retryContainer);
                      const retryScript = new Function(
                        'container',
                        'containerClass',
                        'document',
                        'window',
                        'console',
                        scriptContent
                      );
                      retryScript(retryContainer, containerClass, retryScopedDoc, window, console);
                      successCount++;
                      console.log(`[HTMLApp] Successfully executed script ${index + 1} on retry`);
                    } else {
                      console.warn(`[HTMLApp] Container not ready for retry of script ${index + 1}`);
                    }
                  } catch (retryError) {
                    console.error(`[HTMLApp] Error executing script ${index + 1} on retry for ${containerClass}:`, retryError);
                  }
                }, 150);
              } else {
                console.error(`[HTMLApp] Error executing script ${index + 1}/${extractedScripts.length} for ${containerClass}:`, error);
              }
            }
          });

          hasInitializedRef.current = true;
          console.log(`[HTMLApp] Script initialization complete for ${containerClass} (${successCount}/${totalScripts} scripts executed)`);
        }, 50);
      });

      return true;
    };

    // Try to execute immediately
    if (!executeScriptsWhenReady()) {
      // If not ready, use MutationObserver to wait for DOM changes
      const observer = new MutationObserver(() => {
        if (executeScriptsWhenReady()) {
          observer.disconnect();
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      // Also set a timeout as fallback
      const timeout = setTimeout(() => {
        observer.disconnect();
        executeScriptsWhenReady();
      }, 500);

      return () => {
        observer.disconnect();
        clearTimeout(timeout);
      };
    }
  }, [extractedScripts, containerClass, html]);

  return (
    <div className="w-full h-full overflow-auto p-4" style={{ background: 'var(--dark-brown-surface)' }}>
      <div
        ref={containerRef}
        className={`w-full h-full ${containerClass}`}
        data-container-class={containerClass}
        dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      />
    </div>
  );
}

// Memoize to prevent unnecessary re-renders that could cause container remounts
export default memo(HTMLApp);

