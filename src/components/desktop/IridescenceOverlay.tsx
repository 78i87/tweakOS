'use client';

import { useEffect, useRef, useState } from 'react';
import Iridescence from '@/components/effects/Iridescence';

interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Extract dominant color from an image using canvas
 */
async function extractDominantHSL(imagePath: string): Promise<HSL> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, 32, 32);
        const imageData = ctx.getImageData(0, 0, 32, 32);
        const data = imageData.data;
        
        let r = 0, g = 0, b = 0;
        const pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        
        r = Math.round(r / pixelCount);
        g = Math.round(g / pixelCount);
        b = Math.round(b / pixelCount);
        
        const hsl = rgbToHsl(r, g, b);
        resolve(hsl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imagePath;
  });
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to RGB [0-1]
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return [r, g, b];
}

interface IridescenceOverlayProps {
  onComplete?: () => void;
  startNow?: boolean;
  mouseReact?: boolean;
}

export default function IridescenceOverlay({ 
  onComplete, 
  startNow = false,
  mouseReact = false 
}: IridescenceOverlayProps) {
  const [opacity, setOpacity] = useState(0); // Start invisible, fade in smoothly over 3 seconds
  const [amplitude, setAmplitude] = useState(0);
  // Brown color matches --dark-brown-surface (#3D2F2A) exactly
  const [color, setColor] = useState<[number, number, number]>([0.239, 0.184, 0.165]); // Brown RGB [0-1]
  const mountedRef = useRef(true);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    
    if (!startNow) return;

    const runAnimation = async () => {
      // Initial brown color matches --dark-brown-surface (#3D2F2A) exactly
      // Convert hex to RGB [0-1]: #3D2F2A = rgb(61, 47, 42) = [0.239, 0.184, 0.165]
      const brownRgb: [number, number, number] = [61/255, 47/255, 42/255];
      setColor(brownRgb);
      
      // Also calculate HSL for color transition
      const brownHsl = { h: 28, s: 45, l: 26 };
      
      // Extract wallpaper color in parallel (don't block)
      let wallpaperColor: HSL | null = null;
      extractDominantHSL('/wallpaper.png')
        .then((hsl) => {
          if (mountedRef.current) {
            wallpaperColor = hsl;
          }
        })
        .catch((err) => {
          console.error('Error extracting wallpaper color:', err);
        });

      // Start with opacity 0 and amplitude 0 - will fade in smoothly over 3 seconds
      setOpacity(0);
      setAmplitude(0);
      
      // Transition timeline: 12s (start) → 15s (fully visible) = 3000ms
      const transitionDuration = 3000; // 3 seconds total
      
      const animate = (currentTime: number) => {
        if (!mountedRef.current) return;
        
        if (startTimeRef.current === null) {
          startTimeRef.current = currentTime;
        }
        
        const elapsed = currentTime - startTimeRef.current;
        
        // Phase 1: Smooth fade in opacity (0 → 1) over 3000ms
        // Uses cubic-bezier(0.4, 0, 0.2, 1) matching CSS transition for perfect sync
        if (elapsed < transitionDuration) {
          const fadeProgress = elapsed / transitionDuration;
          // Cubic-bezier(0.4, 0, 0.2, 1) approximation for smooth ease-in-out
          const eased = fadeProgress < 0.5
            ? 4 * fadeProgress * fadeProgress * fadeProgress // Ease-in portion
            : 1 - Math.pow(-2 * fadeProgress + 2, 3) / 2; // Ease-out portion
          setOpacity(eased);
        } else {
          setOpacity(1);
        }
        
        // Phase 2: Ramp amplitude (0 → 1.0) over the same 3000ms period, synchronized with opacity
        if (elapsed < transitionDuration) {
          const rampProgress = elapsed / transitionDuration;
          // Use same smooth easing as opacity for synchronized effect
          const eased = rampProgress < 0.5
            ? 2 * rampProgress * rampProgress * rampProgress // Cubic ease-in
            : 1 - Math.pow(-2 * rampProgress + 2, 3) / 2; // Cubic ease-out
          setAmplitude(eased);
        } else {
          setAmplitude(1.0);
        }
        
        // Phase 3: Color transition starts at ~2000ms (during fade-in) - smoother transition
        if (elapsed >= 2000 && elapsed < 2600 && wallpaperColor) {
          const colorProgress = (elapsed - 2000) / 600;
          const eased = colorProgress < 0.5
            ? 2 * colorProgress * colorProgress
            : 1 - Math.pow(-2 * colorProgress + 2, 2) / 2; // Ease-in-out
          
          const targetRgb = hslToRgb(wallpaperColor.h, wallpaperColor.s, wallpaperColor.l);
          const currentRgb: [number, number, number] = [
            brownRgb[0] + (targetRgb[0] - brownRgb[0]) * eased,
            brownRgb[1] + (targetRgb[1] - brownRgb[1]) * eased,
            brownRgb[2] + (targetRgb[2] - brownRgb[2]) * eased,
          ];
          setColor(currentRgb);
        } else if (elapsed >= 2600 && wallpaperColor) {
          const targetRgb = hslToRgb(wallpaperColor.h, wallpaperColor.s, wallpaperColor.l);
          setColor(targetRgb);
        }
        
        // Phase 4: Hold briefly (400ms after color transition completes)
        const holdStart = 2600;
        const holdEnd = holdStart + 400;
        
        // Phase 5: Ramp down amplitude (1.0 → 0) over 1200ms
        if (elapsed >= holdEnd && elapsed < holdEnd + 1200) {
          const rampDownProgress = (elapsed - holdEnd) / 1200;
          const eased = 1 - Math.pow(1 - rampDownProgress, 3); // Ease-out
          setAmplitude(1.0 - eased);
        } else if (elapsed >= holdEnd + 1200) {
          setAmplitude(0);
        }
        
        // Phase 6: Fade out opacity over 600ms
        const fadeOutStart = holdEnd + 1200;
        if (elapsed >= fadeOutStart && elapsed < fadeOutStart + 600) {
          const fadeOutProgress = (elapsed - fadeOutStart) / 600;
          setOpacity(1 - fadeOutProgress);
        } else if (elapsed >= fadeOutStart + 600) {
          setOpacity(0);
          if (mountedRef.current && onComplete) {
            onComplete();
          }
          return;
        }
        
        if (mountedRef.current) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    runAnimation();
    
    return () => {
      mountedRef.current = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [startNow, onComplete]);

  return (
    <div 
      className="iridescence-fullscreen"
      style={{ opacity }}
    >
      <Iridescence
        color={color}
        amplitude={amplitude}
        speed={1.0}
        mouseReact={mouseReact}
      />
    </div>
  );
}

