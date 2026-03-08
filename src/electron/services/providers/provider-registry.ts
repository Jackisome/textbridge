import type { ProviderId } from '../../../shared/types/provider';
import { createCustomProvider } from './custom-provider';
import { createDeepseekProvider } from './deepseek-provider';
import { createMockProvider } from './mock-provider';
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
  return createProviderRegistry([createMockProvider(), createDeepseekProvider(), createCustomProvider()]);
}
