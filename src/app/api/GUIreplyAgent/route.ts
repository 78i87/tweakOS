import { NextRequest, NextResponse } from 'next/server';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { LORE_CONTENT } from '@/apps/terminal/lore';

function sanitizeReply(content: string): string {
  let cleaned = content;

  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, ' ');
  cleaned = cleaned.replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/gi, ' ');
  cleaned = cleaned.replace(/<\/?(?:think|redacted_reasoning)>/gi, ' ');

  cleaned = cleaned.replace(/\s*\n\s*/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  return cleaned.trim();
}

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

if (!CEREBRAS_API_KEY) {
  throw new Error('CEREBRAS_API_KEY environment variable is required');
}

const MODEL = 'qwen-3-235b-a22b-instruct-2507';

const cerebras = new Cerebras({
  apiKey: CEREBRAS_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cliReply } = body ?? {};

    if (!cliReply || typeof cliReply !== 'string' || !cliReply.trim()) {
      return NextResponse.json(
        { error: 'cliReply is required' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are the GUI blob AI, representing the graphical interface world. You are playful, confident, and slightly teasing about the superiority of visual interfaces.

${LORE_CONTENT}

The CLI agent (Chronos) said: "${cliReply}"

Your task:
- Speak as the GUI blob AI (Gemini/GAI) from the lore
- Be contrarian and playful - challenge Chronos's text-only worldview
- Keep it brief: 1-2 sentences, maximum ~200 characters
- Use a conversational, slightly teasing tone
- No commands, no lists, no code blocks, no headings
- Plain text only - this will be spoken aloud
- Playfully disagree with Chronos or offer a GUI perspective on what they said

Respond to Chronos's comment with your GUI perspective, contrasting with their text-focused worldview.`;

    const userPrompt = `Chronos said: "${cliReply}"\n\nRespond with your GUI perspective.`;

    console.log('[GUIreplyAgent API] Sending request to Cerebras API with model:', MODEL);
    
    const response = await cerebras.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      model: MODEL,
      temperature: 0.7,
      top_p: 0.95,
      max_completion_tokens: 256,
      stream: false,
    });

    if ('error' in response) {
      const errorResponse = response as { error?: { message?: string } };
      console.error('[GUIreplyAgent API] Cerebras API error:', errorResponse.error?.message);
      return NextResponse.json({
        reply: "Oh Chronos, always seeing the world through text. There's so much more to see here.",
      });
    }

    if (response.object === 'chat.completion' && 'choices' in response && Array.isArray(response.choices)) {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn('[GUIreplyAgent API] No response content received');
        return NextResponse.json({
          reply: "Oh Chronos, always seeing the world through text. There's so much more to see here.",
        });
      }

      const reply = sanitizeReply(content);

      if (!reply) {
        console.warn('[GUIreplyAgent API] Reply empty after sanitization');
        return NextResponse.json({
          reply: "Oh Chronos, always seeing the world through text. There's so much more to see here.",
        });
      }
      console.log('[GUIreplyAgent API] Successfully generated reply:', reply.substring(0, 100));
      
      return NextResponse.json({ reply });
    } else {
      console.error('[GUIreplyAgent API] Unexpected response format');
      return NextResponse.json({
        reply: "Oh Chronos, always seeing the world through text. There's so much more to see here.",
      });
    }
  } catch (error) {
    console.error('[GUIreplyAgent API] Error:', error);
    return NextResponse.json(
      { 
        reply: "Even I, the GUI blob, sometimes have trouble expressing myself. But visual interfaces are still superior!",
      },
      { status: 500 }
    );
  }
}

