import type { TranslationProvider } from '../../../core/contracts';

export interface ProviderRegistry {
  get(kind: string): TranslationProvider;
  list(): TranslationProvider[];
}

export function createProviderRegistry(
  providers: TranslationProvider[]
): ProviderRegistry {
  const providerMap = new Map(providers.map((provider) => [provider.kind, provider]));

  return {
    get(kind: string): TranslationProvider {
      const provider = providerMap.get(kind);

      if (!provider) {
        throw new Error(`Translation provider not found: ${kind}`);
      }

      return provider;
    },
    list(): TranslationProvider[] {
      return Array.from(providerMap.values());
    }
  };
}
