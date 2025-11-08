import { NextRequest, NextResponse } from 'next/server';

/**
 * Browser Proxy API Route
 * 
 * Fetches websites server-side and strips X-Frame-Options headers
 * to allow embedding in iframes. Also rewrites URLs in HTML content
 * to ensure resources load correctly through the proxy.
 */

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    // Only allow http and https protocols
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function rewriteUrl(url: string, baseUrl: string, proxyBase: string): string {
  // Skip data URLs, javascript:, mailto:, tel:, hash anchors, etc.
  if (/^(data:|javascript:|mailto:|tel:|#|blob:)/i.test(url.trim())) {
    return url;
  }

  try {
    // If it's already an absolute URL, proxy it
    if (/^https?:\/\//i.test(url)) {
      return `${proxyBase}?url=${encodeURIComponent(url)}`;
    }

    // Convert relative URL to absolute, then proxy it
    const absoluteUrl = new URL(url, baseUrl).href;
    return `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}`;
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

function rewriteUrls(html: string, baseUrl: string, proxyBase: string): string {
  let rewritten = html;

  // Rewrite URLs in HTML attributes
  const attributePatterns = [
    // href attributes
    { regex: /href=["']([^"']+)["']/gi },
    // src attributes
    { regex: /src=["']([^"']+)["']/gi },
    // action attributes (forms)
    { regex: /action=["']([^"']+)["']/gi },
    // poster attributes (video)
    { regex: /poster=["']([^"']+)["']/gi },
    // cite attributes
    { regex: /cite=["']([^"']+)["']/gi },
  ];

  attributePatterns.forEach(({ regex }) => {
    rewritten = rewritten.replace(regex, (match, url) => {
      const rewrittenUrl = rewriteUrl(url, baseUrl, proxyBase);
      return match.replace(url, rewrittenUrl);
    });
  });

  // Handle srcset with multiple URLs (e.g., "image.jpg 1x, image@2x.jpg 2x")
  rewritten = rewritten.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
    const urls = srcset.split(',').map((item: string) => {
      const parts = item.trim().split(/\s+/);
      const url = parts[0];
      const rewrittenUrl = rewriteUrl(url, baseUrl, proxyBase);
      return `${rewrittenUrl} ${parts.slice(1).join(' ')}`.trim();
    });
    return `srcset="${urls.join(', ')}"`;
  });

  // Rewrite CSS @import statements
  rewritten = rewritten.replace(/@import\s+(?:url\()?["']?([^"')]+)["']?\)?/gi, (match, url) => {
    const rewrittenUrl = rewriteUrl(url.trim(), baseUrl, proxyBase);
    return match.replace(url, rewrittenUrl);
  });

  // Rewrite CSS url() in style attributes and style tags
  rewritten = rewritten.replace(/url\(["']?([^"')]+)["']?\)/gi, (match, url) => {
    const rewrittenUrl = rewriteUrl(url.trim(), baseUrl, proxyBase);
    return match.replace(url, rewrittenUrl);
  });

  // Rewrite <link> tags with href (stylesheets, etc.)
  rewritten = rewritten.replace(/<link([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (match, before, url, after) => {
    const rewrittenUrl = rewriteUrl(url, baseUrl, proxyBase);
    return `<link${before}href="${rewrittenUrl}"${after}>`;
  });

  // Rewrite <base> tag href to ensure relative URLs resolve correctly
  rewritten = rewritten.replace(/<base([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (match, before, url, after) => {
    // Keep base tag but ensure it points to the proxied version
    const rewrittenUrl = rewriteUrl(url, baseUrl, proxyBase);
    return `<base${before}href="${rewrittenUrl}"${after}>`;
  });

  return rewritten;
}

function rewriteCssUrls(css: string, baseUrl: string, proxyBase: string): string {
  let rewritten = css;

  // Rewrite CSS @import statements
  rewritten = rewritten.replace(/@import\s+(?:url\()?["']?([^"')]+)["']?\)?/gi, (match, url) => {
    const rewrittenUrl = rewriteUrl(url.trim(), baseUrl, proxyBase);
    return match.replace(url, rewrittenUrl);
  });

  // Rewrite CSS url() references
  rewritten = rewritten.replace(/url\(["']?([^"')]+)["']?\)/gi, (match, url) => {
    const rewrittenUrl = rewriteUrl(url.trim(), baseUrl, proxyBase);
    return match.replace(url, rewrittenUrl);
  });

  return rewritten;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return new NextResponse(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error</title></head><body><h1>Error</h1><p>URL parameter is required</p></body></html>',
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Validate URL
    if (!isValidUrl(targetUrl)) {
      return new NextResponse(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error</title></head><body><h1>Error</h1><p>Invalid URL. Only http and https protocols are allowed.</p></body></html>',
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Fetch the target website
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error ${response.status}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; text-align: center; }
    h1 { color: #d32f2f; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>Error ${response.status}</h1>
  <p>Failed to fetch: ${response.statusText}</p>
  <p>The website may be temporarily unavailable or blocking requests.</p>
</body>
</html>`;
      return new NextResponse(errorHtml, {
        status: response.status,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const content = await response.text();

    // Create response with modified headers
    const headers = new Headers();
    
    // Copy important headers
    // Note: We don't copy 'content-encoding' because Node.js fetch automatically
    // decompresses gzip/brotli content, so the content is already decoded
    const headersToCopy = [
      'content-type',
      'cache-control',
      'expires',
      'last-modified',
      'etag',
    ];

    headersToCopy.forEach(headerName => {
      const value = response.headers.get(headerName);
      if (value) {
        headers.set(headerName, value);
      }
    });

    // Remove X-Frame-Options header
    // Remove Content-Security-Policy frame-ancestors directive
    const cspHeader = response.headers.get('content-security-policy');
    if (cspHeader) {
      // Remove frame-ancestors directive
      const modifiedCsp = cspHeader
        .split(';')
        .map(directive => directive.trim())
        .filter(directive => !directive.toLowerCase().startsWith('frame-ancestors'))
        .join('; ');
      
      if (modifiedCsp) {
        headers.set('content-security-policy', modifiedCsp);
      }
    }

    // Set CORS headers to allow iframe embedding
    headers.set('X-Frame-Options', 'ALLOWALL');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');

    // Rewrite URLs in content based on content type
    let processedContent = content;
    const proxyBase = `${request.nextUrl.origin}/api/browser-proxy`;
    
    if (contentType.includes('text/html')) {
      processedContent = rewriteUrls(content, targetUrl, proxyBase);
    } else if (contentType.includes('text/css') || contentType.includes('stylesheet')) {
      processedContent = rewriteCssUrls(content, targetUrl, proxyBase);
    }
    // For other content types (images, JS, etc.), serve as-is since they're referenced from HTML

    return new NextResponse(processedContent, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error('[Browser Proxy] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to proxy request';
    const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proxy Error</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; text-align: center; }
    h1 { color: #d32f2f; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>Proxy Error</h1>
  <p>${errorMessage}</p>
  <p>Please check the URL and try again.</p>
</body>
</html>`;
    return new NextResponse(errorHtml, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
