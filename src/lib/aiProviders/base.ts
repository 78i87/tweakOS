import { AppGenerationRequest } from '../aiAgent';

export type AIProviderResponse = {
  title: string;
  html: string;
  description?: string;
};

export interface AIProvider {
  generateApp(request: AppGenerationRequest): Promise<AIProviderResponse>;
}

