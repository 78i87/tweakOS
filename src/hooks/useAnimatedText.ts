import { useState, useEffect } from 'react';

/**
 * Hook that animates text by revealing letters one by one from left to right
 * @param text - The full text to animate
 * @param trigger - Boolean that triggers the animation when it becomes true
 * @param delay - Delay between each letter in milliseconds (default: 90ms)
 * @returns The animated text string (partial text revealed so far)
 */
export function useAnimatedText(
  text: string,
  trigger: boolean,
  delay: number = 90
): string {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    // Reset when trigger becomes true
    if (trigger) {
      setVisibleLength(0);
      
      // Start animation
      let currentIndex = 0;
      const timeoutIds: NodeJS.Timeout[] = [];

      const animate = () => {
        if (currentIndex < text.length) {
          const timeoutId = setTimeout(() => {
            setVisibleLength(currentIndex + 1);
            currentIndex++;
            animate();
          }, delay);
          timeoutIds.push(timeoutId);
        }
      };

      animate();

      // Cleanup function
      return () => {
        timeoutIds.forEach(id => clearTimeout(id));
      };
    } else {
      // Reset when trigger becomes false
      setVisibleLength(0);
    }
  }, [text, trigger, delay]);

  return text.substring(0, visibleLength);
}

