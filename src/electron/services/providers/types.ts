import type { ProviderId, ProviderSettings } from '../../../shared/types/provider';

export interface ProviderExecutionContext<Id extends ProviderId = ProviderId> {
  providerId: Id;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  providerSettings: ProviderSettings<Id>;
  prompt: {
    system?: string;
    user: string;
  };
  signal: AbortSignal;
  fetch: typeof globalThis.fetch;
}

export interface ProviderTranslationResult {
  text: string;
  detectedSourceLanguage?: string;
  raw?: unknown;
}

export interface TranslationProvider<Id extends ProviderId = ProviderId> {
  id: Id;
  translate: (context: ProviderExecutionContext<Id>) => Promise<ProviderTranslationResult>;
}
