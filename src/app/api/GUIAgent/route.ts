import { NextRequest, NextResponse } from 'next/server';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { GoogleGenAI } from '@google/genai';

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!CEREBRAS_API_KEY) {
  throw new Error('CEREBRAS_API_KEY environment variable is required');
}
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const PRIMARY_MODEL = 'gpt-oss-120b';
const FALLBACK_MODEL = 'gemini-2.5-flash';

const cerebras = new Cerebras({
  apiKey: CEREBRAS_API_KEY,
});

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

const responseSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'A concise, descriptive title for the generated application',
    },
    html: {
      type: 'string',
      description: 'Complete, self-contained HTML page with inline CSS and JavaScript. Must be valid HTML that can be rendered directly.',
    },
    description: {
      type: 'string',
      description: 'Brief description of what the application does',
    },
  },
  required: ['title', 'html'],
};

/**
 * Fetches site HTML and extracts compact context
 */
async function fetchSiteContext(siteUrl: string): Promise<{
  title: string;
  description: string;
  headings: string[];
  htmlSnippet: string;
} | null> {
  try {
    console.log('[GUIAgent API] Fetching site context from:', siteUrl);
    
    const response = await fetch(siteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.warn('[GUIAgent API] Failed to fetch site:', response.status, response.statusText);
      return null;
    }

    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract headings (first few h1, h2)
    const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi) || [];
    const h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
    const headings = [
      ...h1Matches.slice(0, 3).map(h => h.replace(/<[^>]+>/g, '').trim()),
      ...h2Matches.slice(0, 5).map(h => h.replace(/<[^>]+>/g, '').trim()),
    ].filter(Boolean);

    // Extract body content, remove scripts and styles, limit size
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let htmlSnippet = bodyMatch ? bodyMatch[1] : '';
    
    // Remove scripts
    htmlSnippet = htmlSnippet.replace(/<script[\s\S]*?<\/script>/gi, '');
    // Remove styles
    htmlSnippet = htmlSnippet.replace(/<style[\s\S]*?<\/style>/gi, '');
    // Remove comments
    htmlSnippet = htmlSnippet.replace(/<!--[\s\S]*?-->/g, '');
    // Clean up whitespace
    htmlSnippet = htmlSnippet.replace(/\s+/g, ' ').trim();
    
    // Limit to ~12k characters to avoid token bloat
    if (htmlSnippet.length > 12000) {
      htmlSnippet = htmlSnippet.substring(0, 12000) + '...';
    }

    console.log('[GUIAgent API] Extracted site context:', {
      title,
      description: description.substring(0, 100),
      headingsCount: headings.length,
      snippetLength: htmlSnippet.length,
    });

    return { title, description, headings, htmlSnippet };
  } catch (error) {
    console.warn('[GUIAgent API] Error fetching site context:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Creates browser-edit system prompt with site context
 */
function createBrowserEditPrompt(prompt: string, siteContext: {
  title: string;
  description: string;
  headings: string[];
  htmlSnippet: string;
}): string {
  const { title, description, headings, htmlSnippet } = siteContext;
  
  return `You are an expert web developer specializing in reimagining websites in different visual styles and themes.

SITE CONTEXT:
- Title: ${title || 'Unknown'}
- Description: ${description || 'No description available'}
- Key Headings: ${headings.length > 0 ? headings.join(', ') : 'None found'}
- HTML Structure Sample: ${htmlSnippet.substring(0, 2000)}...

USER REQUEST: "${prompt}"

YOUR TASK:
Reimagine the website described above in the style/theme requested by the user. You should:

1. PRESERVE THE STRUCTURE: Maintain the same information architecture, navigation patterns, and content organization as the original site
2. APPLY THE REQUESTED STYLE: Transform the visual design to match the user's requested theme (e.g., "cyberpunk", "minimalist", "retro", etc.)
3. PRESERVE CONTENT: Keep textual content recognizable and maintain the same meaning, but feel free to adapt wording slightly if needed for the new style
4. AVOID TRADEMARKS: Do NOT copy or display official logos, brand names, or trademarked imagery. Create generic alternatives that convey the same concept
5. MODERN VISUALS: Use contemporary web design techniques, animations, and interactions that align with the requested style
6. SELF-CONTAINED: Generate complete, self-contained HTML with inline CSS and JavaScript

TECHNICAL REQUIREMENTS:
- Wrap the entire application in a single root element with the class "app-root"
- Scope every CSS selector to that root container (e.g., ".app-root .card")
- Avoid global selectors such as body, html, or :root
- Use unique, namespaced class names (e.g., "app-root__button", "app-root--primary")
- Include all necessary JavaScript for interactivity
- Place <style> tags at the beginning of your HTML content
- Ensure the HTML is valid and renderable directly

Return your response as a JSON object with "title", "html", and "description" fields.`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[GUIAgent API] ===== Starting request =====');
  
  try {
    const { prompt, siteUrl } = await request.json();
    console.log('[GUIAgent API] Received prompt:', prompt);
    if (siteUrl) {
      console.log('[GUIAgent API] Received siteUrl:', siteUrl);
    }

    if (!prompt || typeof prompt !== 'string') {
      console.error('[GUIAgent API] Invalid prompt:', prompt);
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Fetch site context if siteUrl is provided
    let siteContext = null;
    let useBrowserEditPrompt = false;
    
    if (siteUrl && typeof siteUrl === 'string') {
      siteContext = await fetchSiteContext(siteUrl);
      if (siteContext) {
        useBrowserEditPrompt = true;
        console.log('[GUIAgent API] Using browser-edit prompt with site context');
      } else {
        console.log('[GUIAgent API] Failed to fetch site context, falling back to normal prompt');
      }
    }

    const systemPrompt = useBrowserEditPrompt && siteContext
      ? createBrowserEditPrompt(prompt, siteContext)
      : `You are an expert web developer. Generate a complete, functional HTML application based on the user's request.

User Request: "${prompt}"

Requirements:
1. Generate a complete, self-contained HTML page with CSS and JavaScript
2. CSS can be applied in two ways:
   - Inline styles using the "style" attribute on HTML elements (preferred for simple styling)
   - CSS rules in <style> tags (use for complex styling, animations, media queries, or when styling multiple elements)
3. STYLING REQUIREMENTS - Pay close attention to any style descriptions in the user's request:
   - If the user mentions a specific style (e.g., "dark theme", "minimalist", "retro", "modern", "colorful", "gradient", "glassmorphism", "neon", etc.), you MUST incorporate that exact style into your design
   - Match color schemes, visual aesthetics, and design patterns mentioned in the prompt
   - Use colors, spacing, typography, and layout that align with the requested style
   - If no specific style is mentioned, use modern, visually appealing styling
4. INTERACTIVITY REQUIREMENTS - Make the application interactive and engaging:
   - If the user's request involves any form of interaction (buttons, forms, animations, games, calculators, etc.), include full JavaScript functionality
   - Add interactive elements even if not explicitly requested - make buttons clickable, forms functional, and add hover effects, transitions, or animations where appropriate
   - Include event handlers, state management, and user feedback mechanisms
   - Ensure all interactive features work smoothly and provide visual feedback
5. Use modern web technologies and best practices
6. Include all necessary JavaScript for interactivity - don't leave placeholders or incomplete functionality
7. The HTML must be valid and renderable directly
8. If using <style> tags, place them at the beginning of your HTML content
9. Ensure all CSS is properly formatted and will apply correctly
10. Wrap the entire application in a single root element with the class "app-root"
11. Scope every CSS selector to that root container (e.g., ".app-root .card"), avoiding global selectors such as body, html, or :root
12. Use unique, namespaced class names (e.g., "app-root__button", "app-root--primary") so styles do not conflict with other windows

Return your response as a JSON object with "title", "html", and "description" fields.`;

    console.log('[GUIAgent API] Sending request to Cerebras API...');
    
    const apiRequestStart = Date.now();
    let responseText: string;
    let modelUsed = PRIMARY_MODEL;
    
    try {
      console.log('[GUIAgent API] Attempting with Cerebras model:', PRIMARY_MODEL);
      const cerebrasResponse = await cerebras.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: PRIMARY_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        top_p: 0.95,
        max_completion_tokens: 8192,
        stream: false,
      });
      
      if ('error' in cerebrasResponse) {
        const errorResponse = cerebrasResponse as { error?: { message?: string } };
        throw new Error(`Cerebras API error: ${errorResponse.error?.message || 'Unknown error'}`);
      }
      
      if (cerebrasResponse.object === 'chat.completion' && 'choices' in cerebrasResponse && Array.isArray(cerebrasResponse.choices)) {
        const content = cerebrasResponse.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response content received from Cerebras API');
        }
        responseText = content;
        console.log(`[GUIAgent API] Successfully used Cerebras model ${PRIMARY_MODEL}`);
      } else {
        throw new Error('Unexpected response format from Cerebras API');
      }
    } catch (primaryError) {
      console.warn(`[GUIAgent API] Cerebras model ${PRIMARY_MODEL} failed, attempting fallback to Gemini ${FALLBACK_MODEL}`);
      console.warn('[GUIAgent API] Primary model error:', primaryError instanceof Error ? primaryError.message : primaryError);
      
      try {
        modelUsed = FALLBACK_MODEL;
        console.log('[GEMINI API] Attempting with Gemini model:', FALLBACK_MODEL);
        const geminiResponse = await genAI.models.generateContent({
          model: FALLBACK_MODEL,
          contents: systemPrompt,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: responseSchema,
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        });
        
        const text = geminiResponse.text;
        if (!text) {
          throw new Error('No response text received from Gemini API');
        }
        responseText = text;
        console.log(`[GEMINI API] Successfully used fallback model ${FALLBACK_MODEL}`);
      } catch (fallbackError) {
        console.error(`[GUIAgent API] Both ${PRIMARY_MODEL} and ${FALLBACK_MODEL} failed`);
        throw fallbackError;
      }
    }
    
    const apiRequestTime = Date.now() - apiRequestStart;
    console.log(`[GUIAgent API] API request completed in ${apiRequestTime}ms using model: ${modelUsed}`);
    console.log('[GUIAgent API] Response received, length:', responseText.length);
    
    const parseStart = Date.now();
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[GUIAgent API] JSON parse error:', parseError);
      parsed = parseGUIAgentResponse(responseText, prompt);
    }
    
    const parseTime = Date.now() - parseStart;
    
    if (!parsed.title || !parsed.html) {
      console.error('[GUIAgent API] Invalid response structure:', parsed);
      return NextResponse.json(
        { error: 'Invalid response format from API' },
        { status: 500 }
      );
    }
    
    let html = parsed.html;
    if (typeof html === 'string') {
      html = html
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
    }
    
    const result = {
      title: parsed.title,
      html: html,
      description: parsed.description || `Generated app for: ${prompt}`,
    };
    
    console.log('[GUIAgent API] Parsed result:', {
      title: result.title,
      htmlLength: result.html.length,
      htmlPreview: result.html.substring(0, 200),
      description: result.description,
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`[GUIAgent API] Total processing time: ${totalTime}ms (API: ${apiRequestTime}ms, Parse: ${parseTime}ms)`);
    console.log('[GUIAgent API] ===== Request completed =====');
    
    return NextResponse.json(result);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[GUIAgent API] ===== Error occurred =====');
    console.error('[GUIAgent API] Error after', totalTime, 'ms:', error);
    console.error('[GUIAgent API] Error details:', error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : error);
    console.error('[GUIAgent API] ===== End error =====');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate app' },
      { status: 500 }
    );
  }
}

function parseGUIAgentResponse(text: string, originalPrompt: string): { title: string; html: string; description?: string } {
  console.log('[PARSE] Starting to parse GUIAgent response');
  console.log('[PARSE] Raw text length:', text.length);
  
  let cleanedText = text.trim();
  
  const beforeClean = cleanedText;
  cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  if (beforeClean !== cleanedText) {
    console.log('[PARSE] Removed markdown code blocks');
  }
  
  let jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonMatch = [cleanedText.substring(firstBrace, lastBrace + 1)];
      console.log('[PARSE] Found JSON by brace matching');
    }
  }
  
  if (jsonMatch) {
    console.log('[PARSE] Found JSON match, length:', jsonMatch[0].length);
    console.log('[PARSE] JSON preview:', jsonMatch[0].substring(0, 300));
    
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[PARSE] Successfully parsed JSON');
      console.log('[PARSE] Parsed object keys:', Object.keys(parsed));
      console.log('[PARSE] Title:', parsed.title);
      console.log('[PARSE] HTML type:', typeof parsed.html);
      console.log('[PARSE] HTML length:', parsed.html?.length);
      console.log('[PARSE] HTML preview (first 300 chars):', parsed.html?.substring(0, 300));
      
      if (parsed.title && parsed.html) {
        let html = parsed.html;
        
        if (!html.trim() || html.trim().length < 10) {
          console.warn('[PARSE] HTML is empty or too short, using fallback');
          html = generateFallbackHTML(parsed.title, originalPrompt);
        } else {
          html = html
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');
          
          console.log('[PARSE] HTML after unescaping, length:', html.length);
        }
        
        return {
          title: parsed.title,
          html: html,
          description: parsed.description || `Generated app for: ${originalPrompt}`,
        };
      } else {
        console.warn('[PARSE] Missing title or html in parsed JSON');
      }
    } catch (e) {
      console.error('[PARSE] Failed to parse JSON:', e);
      console.error('[PARSE] JSON that failed:', jsonMatch[0].substring(0, 500));
    }
  } else {
    console.warn('[PARSE] No JSON match found in response');
  }
  
  console.log('[PARSE] Trying HTML extraction fallback');
  const htmlMatch = cleanedText.match(/<html[\s\S]*<\/html>/i) || cleanedText.match(/<div[\s\S]*<\/div>/i);
  
  if (htmlMatch) {
    console.log('[PARSE] Found HTML match');
    const title = extractTitle(originalPrompt);
    return {
      title,
      html: htmlMatch[0],
      description: `Generated app for: ${originalPrompt}`,
    };
  }
  
  console.log('[PARSE] Using last resort fallback');
  const title = extractTitle(originalPrompt);
  return {
    title,
    html: generateFallbackHTML(title, originalPrompt),
    description: `Generated app for: ${originalPrompt}`,
  };
}

function generateFallbackHTML(title: string, prompt: string): string {
  return `
    <div style="padding: 40px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <h1 style="margin-bottom: 20px; color: #333;">${title}</h1>
      <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <p style="color: #666; margin: 0;">Generated app for: ${prompt}</p>
      </div>
      <div style="background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
        <p style="color: #333;">The AI-generated content could not be parsed. Please try again with a more specific prompt.</p>
      </div>
    </div>
  `;
}

function extractTitle(prompt: string): string {
  const words = prompt.split(/\s+/).filter(w => w.length > 0);
  const skipWords = ['create', 'make', 'build', 'generate', 'a', 'an', 'the'];
  const meaningfulWords = words.filter(w => !skipWords.includes(w.toLowerCase()));
  
  if (meaningfulWords.length > 0) {
    return meaningfulWords
      .slice(0, 4)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  
  return 'Custom App';
}

