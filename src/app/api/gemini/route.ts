import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAqhl36UPpGS0gFFlv92D4JCJ5j_ERHR9U';
const PRIMARY_MODEL = 'gemini-2.5-pro';
const FALLBACK_MODEL = 'gemini-2.5-flash';

// Initialize the Gemini client
const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

// JSON Schema for structured output
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[GEMINI API] ===== Starting request =====');
  
  try {
    const { prompt } = await request.json();
    console.log('[GEMINI API] Received prompt:', prompt);

    if (!prompt || typeof prompt !== 'string') {
      console.error('[GEMINI API] Invalid prompt:', prompt);
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert web developer. Generate a complete, functional HTML application based on the user's request.

User Request: "${prompt}"

Requirements:
1. Generate a complete, self-contained HTML page with CSS and JavaScript
2. CSS can be applied in two ways:
   - Inline styles using the "style" attribute on HTML elements (preferred for simple styling)
   - CSS rules in <style> tags (use for complex styling, animations, media queries, or when styling multiple elements)
3. Make it visually appealing with modern styling - use colors, spacing, typography, and layout effectively
4. Ensure it's fully functional and interactive
5. Use modern web technologies and best practices
6. Include all necessary JavaScript for interactivity
7. The HTML must be valid and renderable directly
8. If using <style> tags, place them at the beginning of your HTML content
9. Ensure all CSS is properly formatted and will apply correctly
10. Wrap the entire application in a single root element with the class "app-root"
11. Scope every CSS selector to that root container (e.g., ".app-root .card"), avoiding global selectors such as body, html, or :root
12. Use unique, namespaced class names (e.g., "app-root__button", "app-root--primary") so styles do not conflict with other windows

Generate the app now:`;

    console.log('[GEMINI API] Sending request to Gemini API...');
    
    const apiRequestStart = Date.now();
    let response;
    let modelUsed = PRIMARY_MODEL;
    
    // Try primary model first, fallback to flash if it fails
    try {
      console.log('[GEMINI API] Attempting with model:', PRIMARY_MODEL);
      response = await genAI.models.generateContent({
        model: PRIMARY_MODEL,
        contents: systemPrompt,
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });
      console.log(`[GEMINI API] Successfully used ${PRIMARY_MODEL}`);
    } catch (primaryError) {
      console.warn(`[GEMINI API] ${PRIMARY_MODEL} failed, attempting fallback to ${FALLBACK_MODEL}`);
      console.warn('[GEMINI API] Primary model error:', primaryError instanceof Error ? primaryError.message : primaryError);
      
      try {
        modelUsed = FALLBACK_MODEL;
        response = await genAI.models.generateContent({
          model: FALLBACK_MODEL,
          contents: systemPrompt,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: responseSchema,
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        });
        console.log(`[GEMINI API] Successfully used fallback model ${FALLBACK_MODEL}`);
      } catch (fallbackError) {
        console.error(`[GEMINI API] Both ${PRIMARY_MODEL} and ${FALLBACK_MODEL} failed`);
        throw fallbackError;
      }
    }
    
    const apiRequestTime = Date.now() - apiRequestStart;
    console.log(`[GEMINI API] API request completed in ${apiRequestTime}ms using model: ${modelUsed}`);

    // Extract the response text
    const responseText = response.text;
    if (!responseText) {
      throw new Error('No response text received from Gemini API');
    }
    console.log('[GEMINI API] Response received, length:', responseText.length);
    
    // Parse JSON response (should be valid JSON due to structured output)
    const parseStart = Date.now();
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[GEMINI API] JSON parse error:', parseError);
      // Fallback parsing
      parsed = parseGeminiResponse(responseText, prompt);
    }
    
    const parseTime = Date.now() - parseStart;
    
    // Validate response structure
    if (!parsed.title || !parsed.html) {
      console.error('[GEMINI API] Invalid response structure:', parsed);
      return NextResponse.json(
        { error: 'Invalid response format from Gemini API' },
        { status: 500 }
      );
    }
    
    // Clean up HTML (unescape if needed)
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
    
    console.log('[GEMINI API] Parsed result:', {
      title: result.title,
      htmlLength: result.html.length,
      htmlPreview: result.html.substring(0, 200),
      description: result.description,
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`[GEMINI API] Total processing time: ${totalTime}ms (API: ${apiRequestTime}ms, Parse: ${parseTime}ms)`);
    console.log('[GEMINI API] ===== Request completed =====');
    
    return NextResponse.json(result);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[GEMINI API] ===== Error occurred =====');
    console.error('[GEMINI API] Error after', totalTime, 'ms:', error);
    console.error('[GEMINI API] Error details:', error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : error);
    console.error('[GEMINI API] ===== End error =====');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate app' },
      { status: 500 }
    );
  }
}

function parseGeminiResponse(text: string, originalPrompt: string): { title: string; html: string; description?: string } {
  console.log('[PARSE] Starting to parse Gemini response');
  console.log('[PARSE] Raw text length:', text.length);
  
  // Try to extract JSON from the response
  let cleanedText = text.trim();
  
  // Remove markdown code blocks
  const beforeClean = cleanedText;
  cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  if (beforeClean !== cleanedText) {
    console.log('[PARSE] Removed markdown code blocks');
  }
  
  // Try to find JSON object - be more aggressive
  let jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  
  // If no match, try to find JSON that might have leading/trailing text
  if (!jsonMatch) {
    // Try to find JSON starting from first {
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
        // Handle escaped HTML strings - if HTML contains escaped newlines, unescape them
        let html = parsed.html;
        
        // Check if HTML is just whitespace or empty
        if (!html.trim() || html.trim().length < 10) {
          console.warn('[PARSE] HTML is empty or too short, using fallback');
          html = generateFallbackHTML(parsed.title, originalPrompt);
        } else {
          // Unescape common escape sequences
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
  
  // Fallback: if JSON parsing fails, try to extract HTML directly
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
  
  // Last resort: wrap the entire response in HTML
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

