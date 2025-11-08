import { NextRequest, NextResponse } from 'next/server';

const ELEVEN_LABS_KEY = process.env.ELEVEN_LABS_KEY;
if (!ELEVEN_LABS_KEY) {
  throw new Error('ELEVEN_LABS_KEY environment variable is required');
}

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const voice = voiceId || 'RILOU7YmBhvwJGDGjNmP'; // Default to Jane voice

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?optimize_streaming_latency=4&output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVEN_LABS_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ELEVENLABS API] Error:', response.status, errorText);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}` },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(audioBuffer);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[ELEVENLABS API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate speech' },
      { status: 500 }
    );
  }
}


