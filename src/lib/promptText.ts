const DEFAULT_PROMPT_PLACEHOLDER = "Let's imagine...";
const STORAGE_KEY = 'prompt.placeholder';

export function getPromptPlaceholder(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
  }

  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PROMPT_PLACEHOLDER) {
    return process.env.NEXT_PUBLIC_PROMPT_PLACEHOLDER;
  }

  return DEFAULT_PROMPT_PLACEHOLDER;
}

export function setPromptPlaceholder(text: string): void {
  if (typeof window !== 'undefined') {
    if (text && text.trim()) {
      localStorage.setItem(STORAGE_KEY, text.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export function resetPromptPlaceholder(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
