/**
 * Audio activity detector using Web Audio API
 * Detects speech vs silence in HTMLAudioElement playback with hysteresis to avoid flickering
 */

export interface AudioActivityOptions {
  /** Called when speech is detected (transition from silence to speech) */
  onSpeakingStart?: () => void;
  /** Called when silence is detected (transition from speech to silence) */
  onSpeakingStop?: () => void;
  /** Silence threshold in dB (default: -55) */
  silenceThreshold?: number;
  /** Minimum duration in ms that speech must be detected before triggering onSpeakingStart (default: 120) */
  minSpeechDuration?: number;
  /** Minimum duration in ms that silence must be detected before triggering onSpeakingStop (default: 250) */
  minSilenceDuration?: number;
  /** Analysis interval in ms (default: 50) */
  analysisInterval?: number;
}

/**
 * Attaches audio activity detection to an HTMLAudioElement
 * @param audio The audio element to monitor
 * @param options Configuration options
 * @returns Cleanup function to stop detection
 */
export function attachAudioActivity(
  audio: HTMLAudioElement,
  options: AudioActivityOptions = {}
): () => void {
  const {
    onSpeakingStart,
    onSpeakingStop,
    silenceThreshold = -55,
    minSpeechDuration = 120,
    minSilenceDuration = 250,
    analysisInterval = 50,
  } = options;

  // Early return if no callbacks provided
  if (!onSpeakingStart && !onSpeakingStop) {
    return () => {};
  }

  let audioContext: AudioContext | null = null;
  let sourceNode: MediaElementAudioSourceNode | null = null;
  let analyserNode: AnalyserNode | null = null;
  let animationFrameId: number | null = null;
  let intervalId: NodeJS.Timeout | null = null;
  let isActive = false;
  let currentState: 'silent' | 'speaking' = 'silent';
  let stateStartTime = 0;
  let smoothedRms = 0;
  const smoothingFactor = 0.8; // For exponential moving average

  const stopAnalysis = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    isActive = false;
  };

  const cleanup = () => {
    stopAnalysis();
    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      sourceNode = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {
        // Ignore close errors
      });
    }
    audioContext = null;
    analyserNode = null;
  };

  const analyzeAudio = () => {
    if (!analyserNode || !isActive) {
      return;
    }

    try {
      const bufferLength = analyserNode.fftSize;
      const dataArray = new Float32Array(bufferLength);
      analyserNode.getFloatTimeDomainData(dataArray);

      // Calculate RMS (Root Mean Square)
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      // Smooth the RMS value to reduce jitter
      smoothedRms = smoothingFactor * smoothedRms + (1 - smoothingFactor) * rms;

      // Convert to dB (avoid log(0))
      const db = smoothedRms > 0 ? 20 * Math.log10(smoothedRms) : -Infinity;

      const now = Date.now();
      const isAboveThreshold = db > silenceThreshold;

      if (currentState === 'silent') {
        if (isAboveThreshold) {
          const duration = now - stateStartTime;
          if (duration >= minSpeechDuration) {
            currentState = 'speaking';
            stateStartTime = now;
            onSpeakingStart?.();
          }
        } else {
          // Reset timer if we drop below threshold
          stateStartTime = now;
        }
      } else {
        // currentState === 'speaking'
        if (!isAboveThreshold) {
          const duration = now - stateStartTime;
          if (duration >= minSilenceDuration) {
            currentState = 'silent';
            stateStartTime = now;
            onSpeakingStop?.();
          }
        } else {
          // Reset timer if we go back above threshold
          stateStartTime = now;
        }
      }
    } catch (error) {
      // Silently handle analysis errors
      console.warn('[AudioActivity] Analysis error:', error);
    }
  };

  const startDetection = async () => {
    if (isActive) {
      return;
    }

    try {
      // Reuse existing AudioContext if available, otherwise create new one
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create source node from audio element (only if not already created)
        if (!sourceNode) {
          sourceNode = audioContext.createMediaElementSource(audio);
        }
        
        // Create analyser node (only if not already created)
        if (!analyserNode) {
          analyserNode = audioContext.createAnalyser();
          analyserNode.fftSize = 2048;
          analyserNode.smoothingTimeConstant = 0.8;
          
          // Connect: source -> analyser -> destination
          sourceNode.connect(analyserNode);
          analyserNode.connect(audioContext.destination);
        }
      }
      
      // Resume AudioContext if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      isActive = true;
      currentState = 'silent';
      stateStartTime = Date.now();
      smoothedRms = 0;

      // Start periodic analysis
      intervalId = setInterval(analyzeAudio, analysisInterval);
    } catch (error) {
      console.warn('[AudioActivity] Failed to initialize:', error);
      cleanup();
    }
  };

  // Start detection when audio starts playing
  const handlePlay = () => {
    startDetection();
  };

  // Stop detection when audio pauses (but keep listeners for resume)
  const handlePause = () => {
    if (currentState === 'speaking') {
      onSpeakingStop?.();
      currentState = 'silent';
    }
    stopAnalysis();
  };

  const handleEnded = () => {
    if (currentState === 'speaking') {
      onSpeakingStop?.();
    }
    cleanup();
  };

  const handleError = () => {
    cleanup();
  };

  // Attach event listeners
  audio.addEventListener('play', handlePlay);
  audio.addEventListener('pause', handlePause);
  audio.addEventListener('ended', handleEnded);
  audio.addEventListener('error', handleError);

  // If audio is already playing, start detection immediately
  if (!audio.paused && audio.readyState >= 2) {
    startDetection();
  }

  // Return cleanup function
  return () => {
    audio.removeEventListener('play', handlePlay);
    audio.removeEventListener('pause', handlePause);
    audio.removeEventListener('ended', handleEnded);
    audio.removeEventListener('error', handleError);
    cleanup();
  };
}

