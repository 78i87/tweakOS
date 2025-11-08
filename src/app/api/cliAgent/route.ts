import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    let contextStr = `Current working directory: ${context?.cwd || '/'}\n\n`;
    
    if (context?.history && context.history.length > 0) {
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

