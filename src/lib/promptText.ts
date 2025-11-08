/**
 * Centralized prompt placeholder text management
 * Priority: localStorage > environment variable > default
 */

const DEFAULT_PROMPT_PLACEHOLDER = "Let's make something";
const STORAGE_KEY = 'prompt.placeholder';

/**
 * Gets the prompt placeholder text
 * Checks in order: localStorage, environment variable, default
 */
export function getPromptPlaceholder(): string {
  // Check localStorage first (for runtime customization)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
  }

  // Check environment variable
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PROMPT_PLACEHOLDER) {
    return process.env.NEXT_PUBLIC_PROMPT_PLACEHOLDER;
  }

  // Return default
  return DEFAULT_PROMPT_PLACEHOLDER;
}

/**
 * Sets a custom prompt placeholder text (stores in localStorage)
 * Useful for future settings UI
 */
export function setPromptPlaceholder(text: string): void {
  if (typeof window !== 'undefined') {
    if (text && text.trim()) {
      localStorage.setItem(STORAGE_KEY, text.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

/**
 * Resets to default placeholder (removes localStorage override)
 */
export function resetPromptPlaceholder(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
