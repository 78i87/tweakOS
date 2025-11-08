import { useState, useEffect } from 'react';

export function useAnimatedText(
  text: string,
  trigger: boolean,
  delay: number = 90
): string {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    if (trigger) {
      setVisibleLength(0);
      
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

      return () => {
        timeoutIds.forEach(id => clearTimeout(id));
      };
    } else {
      setVisibleLength(0);
    }
  }, [text, trigger, delay]);

  return text.substring(0, visibleLength);
}

