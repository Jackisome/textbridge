import type { ProviderId } from '../../../shared/types/provider';
import { createClaudeProvider } from './claude-provider';
import { createCustomProvider } from './custom-provider';
import { createDeepseekProvider } from './deepseek-provider';
import { createGeminiProvider } from './gemini-provider';
import { createGoogleProvider } from './google-provider';
import { createMinimaxProvider } from './minimax-provider';
import { createMockProvider } from './mock-provider';
import { createTencentProvider } from './tencent-provider';
import { createTongyiProvider } from './tongyi-provider';
import type { TranslationProvider } from './types';

export interface ProviderRegistry {
  get: (id: ProviderId) => TranslationProvider | undefined;
  list: () => TranslationProvider[];
}

export function createProviderRegistry(providers: TranslationProvider[]): ProviderRegistry {
  const providerMap = new Map<ProviderId, TranslationProvider>();

  for (const provider of providers) {
    providerMap.set(provider.id, provider);
  }

  return {
    get(id) {
      return providerMap.get(id);
    },
    list() {
      return [...providerMap.values()];
    }
  };
}

export function createDefaultProviderRegistry(): ProviderRegistry {
  return createProviderRegistry([
    createMockProvider() as TranslationProvider,
    createClaudeProvider() as TranslationProvider,
    createDeepseekProvider() as TranslationProvider,
    createMinimaxProvider() as TranslationProvider,
    createGeminiProvider() as TranslationProvider,
    createGoogleProvider() as TranslationProvider,
    createTencentProvider() as TranslationProvider,
    createTongyiProvider() as TranslationProvider,
    createCustomProvider() as TranslationProvider
  ]);
}
