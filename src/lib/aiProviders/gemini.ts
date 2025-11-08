import { AIProvider, AIProviderResponse } from './base';
import { AppGenerationRequest } from '../aiAgent';

/**
 * Google Gemini AI Provider
 * Uses Gemini 2.5 Pro model via Next.js API route
 */
export class GeminiAIProvider implements AIProvider {
  async generateApp(request: AppGenerationRequest): Promise<AIProviderResponse> {
    const startTime = Date.now();
    console.log('[GEMINI PROVIDER] ===== Starting generation =====');
    console.log('[GEMINI PROVIDER] Prompt:', request.prompt);
    
    try {
      const fetchStart = Date.now();
      console.log('[GEMINI PROVIDER] Sending request to /api/gemini...');
      
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
        }),
      });

      const fetchTime = Date.now() - fetchStart;
      console.log(`[GEMINI PROVIDER] Fetch completed in ${fetchTime}ms`);
      console.log('[GEMINI PROVIDER] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[GEMINI PROVIDER] API error:', errorData);
        throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
      }

      const parseStart = Date.now();
      const data = await response.json();
      const parseTime = Date.now() - parseStart;
      
      console.log('[GEMINI PROVIDER] Response parsed in', parseTime, 'ms');
      console.log('[GEMINI PROVIDER] Response data:', {
        hasTitle: !!data.title,
        hasHtml: !!data.html,
        title: data.title,
        htmlLength: data.html?.length,
        htmlPreview: data.html?.substring(0, 200),
        description: data.description,
      });
      
      if (!data.title || !data.html) {
        console.error('[GEMINI PROVIDER] Invalid response format:', data);
        throw new Error('Invalid response format from API');
      }

      const totalTime = Date.now() - startTime;
      console.log(`[GEMINI PROVIDER] Total time: ${totalTime}ms`);
      console.log('[GEMINI PROVIDER] ===== Generation completed =====');

      return {
        title: data.title,
        html: data.html,
        description: data.description,
      };
    } catch (error) {
      console.error('[GEMINI PROVIDER] Error:', error);
      throw error;
    }
  }
}

