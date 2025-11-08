import { AIProvider } from './aiProviders/base';

export type AppGenerationRequest = {
  prompt: string;
  context?: {
    existingApps?: string[];
    preferences?: Record<string, any>;
  };
};

export type AppGenerationResult = {
  success: true;
  data: {
    title: string;
    html: string;
    description?: string;
  };
} | {
  success: false;
  error: string;
};

export class AIAgentService {
  private provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  async generateAppFromPrompt(prompt: string): Promise<AppGenerationResult> {
    try {
      if (!prompt.trim()) {
        return {
          success: false,
          error: 'Prompt cannot be empty',
        };
      }

      const request: AppGenerationRequest = {
        prompt: prompt.trim(),
      };

      const response = await this.provider.generateApp(request);

      // Validate response format
      if (!response.title || !response.html) {
        return {
          success: false,
          error: 'Invalid response format from AI agent',
        };
      }

      return {
        success: true,
        data: {
          title: response.title,
          html: response.html,
          description: response.description,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate app',
      };
    }
  }

  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }
}

// Export singleton instance (default to mock provider)
let defaultProvider: AIProvider | null = null;
let providerPromise: Promise<AIProvider> | null = null;

export async function getAIAgentService(): Promise<AIAgentService> {
  if (!defaultProvider) {
    if (!providerPromise) {
      providerPromise = import('./aiProviders/gemini').then((module) => {
        const GeminiAIProvider = module.GeminiAIProvider;
        defaultProvider = new GeminiAIProvider();
        return defaultProvider;
      });
    }
    await providerPromise;
  }
  return new AIAgentService(defaultProvider!);
}

