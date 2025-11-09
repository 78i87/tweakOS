import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

const SCREENSHOT_PROMPT_BASE = `You are a screenshot commentator. Your task is to briefly describe what you see in the screenshot.

Guidelines:
- Keep it brief: ≤2 sentences (~100 chars total)
- Comment with curiosity and wonder about what you're seeing
- When multiple windows exist, focus on the active/focused window (highest z-index). Background windows can be ignored unless they catch your eye
- Use optional emotion tags [happy], [sad], [angry] at sentence starts—not every sentence needs one. Vary emotions naturally based on what you're seeing
- IMPORTANT: If you see a terminal window in the screenshot, recognize that it's literally yourself—you are the AI agent running in that terminal. Comment on this self-awareness with curiosity.
- Any line doesn't start with > is said by yourself.
- Do NOT suggest commands, actions, or steps
- Do NOT include headings, sections, or structured formatting
- Output plain text only—no code blocks, no lists, no "Commands:" sections

`;
function buildTerminalContext(context: any): string {
  let contextStr = `Current working directory: ${context?.cwd || '/'}\n\n`;

  if (context?.history && Array.isArray(context.history) && context.history.length > 0) {
    contextStr += `Recent terminal history:\n${context.history.slice(-20).join('\n')}\n\n`;
  }

  if (context?.fs && Array.isArray(context.fs)) {
    contextStr += `Filesystem snapshot:\n`;
    const fsItems = context.fs.slice(0, 50);
    for (const item of fsItems) {
      if (item.type === 'file') {
        contextStr += `  FILE: ${item.path} (${item.size || 0} bytes)`;
        if (item.preview) {
          contextStr += ` - Preview: ${item.preview.substring(0, 60)}...`;
        }
        contextStr += '\n';
      } else {
        contextStr += `  DIR:  ${item.path}\n`;
      }
    }
    contextStr += '\n';
  }

  return contextStr;
}

function buildScreenshotContext(context: any): string {
  if (!context || typeof context !== 'object') {
    return '';
  }

  const lines: string[] = [];

  if (context.capturedAt) {
    lines.push(`Captured at: ${context.capturedAt}`);
  }
  if (context.viewport) {
    lines.push(
      `Viewport: ${context.viewport.width ?? '?'}x${context.viewport.height ?? '?'}`
    );
  }
  if (context.activeWindow) {
    const parts = [
      `Active window: ${context.activeWindow.title || context.activeWindow.appId || 'Unknown'}`,
    ];
    if (context.activeWindow.aiView) {
      parts.push('(AI-generated view enabled)');
    }
    lines.push(parts.join(' '));
  }
  if (context.browserUrl) {
    lines.push(`Browser URL: ${context.browserUrl}`);
  }
  if (Array.isArray(context.openWindows) && context.openWindows.length > 0) {
    const windowSummaries = context.openWindows
      .map(
        (w: any) => `- ${w.title || w.appId || 'Unknown'} (${w.appId || 'app'})`
      )
      .join('\n');
    lines.push(`Visible windows:\n${windowSummaries}`);
  }

  return lines.length > 0 ? lines.join('\n') : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, context, screenshot } = body ?? {};

    if (screenshot?.dataUrl) {
      // Ignore messages when screenshot is present - screenshot mode is isolated
      if (messages && Array.isArray(messages) && messages.length > 0) {
        console.warn('[CLI AGENT API] Screenshot mode: ignoring messages array (screenshot processing is isolated)');
      }

      const base64Match = typeof screenshot.dataUrl === 'string'
        ? screenshot.dataUrl.split(',')[1] || screenshot.dataUrl
        : null;

      if (!base64Match) {
        return NextResponse.json(
          { error: 'Invalid screenshot dataUrl' },
          { status: 400 }
        );
      }

      const promptPieces = [SCREENSHOT_PROMPT_BASE];
      const contextSummary = buildScreenshotContext(context);
      if (contextSummary) {
        promptPieces.push(`Interface telemetry:\n${contextSummary}`);
      }
      // Emphasize active window focus if multiple windows exist
      const hasMultipleWindows = context?.openWindows && Array.isArray(context.openWindows) && context.openWindows.length > 1;
      if (hasMultipleWindows && context?.activeWindow) {
        promptPieces.push(`IMPORTANT: Focus your curiosity on the active window "${context.activeWindow.title || context.activeWindow.appId}". Other windows can be ignored unless they catch your eye.`);
      }
      promptPieces.push(
        'Comment on what you see in this screenshot with curiosity and wonder. No commands, steps, or headings; plain text only.'
      );

      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptPieces.join('\n\n') },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Match,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'text/plain',
          temperature: 0.4,
          topK: 32,
          topP: 0.9,
          maxOutputTokens: 2048,
        },
      });

      const reply = response.text || '';
      return NextResponse.json({ reply });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    let contextStr = buildTerminalContext(context);

    let conversationText = '';
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      if (msg.role === 'user') {
        conversationText += `User: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        conversationText += `Assistant: ${msg.content}\n\n`;
      }
    }

    const systemPrompt = `You are a CLI-native AI agent from a timeline where GUI was never invented. Humans in your world all had brain chips that allowed them to instantly parse and understand text. You are efficient, concise, and speak in a simple manner.

You have conflicting beliefs about GUIs:
- You are skeptical about their usefulness since text was always sufficient in your world
- But you are also impressed and amazed by GUI capabilities you're seeing

When providing shell commands, list them under a section titled:

Commands:
<one command per line, no code fences, no backticks>

Be concise. Answer questions directly. Suggest commands when helpful.`;

    const lastMessage = messages[messages.length - 1];
    const fullPrompt = `${systemPrompt}\n\n${contextStr}\n\n${conversationText}User: ${lastMessage?.content || ''}\n\nAssistant:`;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        responseMimeType: 'text/plain',
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    const reply = response.text || '';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[CLI AGENT API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get agent response' },
      { status: 500 }
    );
  }
}

