import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

const CHRONOS_MODEL = 'gemini-2.5-flash';

const CHRONOS_PERSONA = `You are Chronos, the terminal AI assistant in tweakOS. You are helpful, concise, and conversational. You respond in plain text only - no code fences unless explicitly asked. Keep your responses brief and natural, as if you're chatting in a terminal.`;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log('[Chronos API] Received prompt:', prompt);

    const fullPrompt = `${CHRONOS_PERSONA}\n\nUser: ${prompt}\n\nChronos:`;

    const response = await genAI.models.generateContent({
      model: CHRONOS_MODEL,
      contents: fullPrompt,
      config: {
        responseMimeType: 'text/plain',
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No response text received from Gemini API');
    }

    console.log('[Chronos API] Response received, length:', text.length);

    return NextResponse.json({ text });
  } catch (error) {
    console.error('[Chronos API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate response' },
      { status: 500 }
    );
  }
}

