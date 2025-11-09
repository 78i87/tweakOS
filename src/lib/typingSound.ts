let audioContext: AudioContext | null = null;
let gainNode: GainNode | null = null;
let typingBuffer: AudioBuffer | null = null;
let preloadPromise: Promise<void> | null = null;
let lastPlayAt = 0;

const TYPING_AUDIO_PATH = '/typing.mp3';
const MINIMUM_PLAY_INTERVAL_MS = 15;

function supportsAudio(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined';
}

function getAudioContext(): AudioContext | null {
  if (!supportsAudio()) {
    return null;
  }

  if (!audioContext) {
    try {
      audioContext = new AudioContext();
      gainNode = audioContext.createGain();
      gainNode.gain.value = 0.4;
      gainNode.connect(audioContext.destination);
    } catch (error) {
      console.debug('[typingSound] Failed to create AudioContext:', error);
      audioContext = null;
      gainNode = null;
    }
  }

  return audioContext;
}

async function fetchAndDecodeAudio(ctx: AudioContext): Promise<void> {
  const response = await fetch(TYPING_AUDIO_PATH);
  const arrayBuffer = await response.arrayBuffer();
  typingBuffer = await ctx.decodeAudioData(arrayBuffer);
}

export async function preloadTypingSound(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  if (typingBuffer) {
    return;
  }

  if (!preloadPromise) {
    preloadPromise = fetchAndDecodeAudio(ctx).catch((error) => {
      console.debug('[typingSound] Failed to preload typing audio:', error);
      typingBuffer = null;
    }).finally(() => {
      preloadPromise = null;
    });
  }

  await preloadPromise;
}

function playViaWebAudio(): boolean {
  const ctx = getAudioContext();
  if (!ctx || !gainNode || !typingBuffer) {
    return false;
  }

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = performance.now();
  if (now - lastPlayAt < MINIMUM_PLAY_INTERVAL_MS) {
    return true;
  }
  lastPlayAt = now;

  try {
    const source = ctx.createBufferSource();
    source.buffer = typingBuffer;
    source.playbackRate.value = 0.98 + Math.random() * 0.06;
    source.connect(gainNode);
    source.start();
    return true;
  } catch (error) {
    console.debug('[typingSound] Failed to play via Web Audio:', error);
    return false;
  }
}

function playViaHtmlAudio(): void {
  try {
    const audio = new Audio(TYPING_AUDIO_PATH);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  } catch (error) {
    console.debug('[typingSound] Failed to play via HTMLAudioElement:', error);
  }
}

export async function playTypingSound(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (!typingBuffer && !preloadPromise) {
    preloadTypingSound().catch(() => {});
  }

  if (playViaWebAudio()) {
    return;
  }

  playViaHtmlAudio();
}

