import type { TranslationProvider } from '../../core/contracts';
import type { TranslationRequest, TranslationResult } from '../../core/entities/translation';
import type { ProviderSettings, TranslationProviderKind } from '../../shared/types/settings';
import {
  createHttpProvider,
  type HttpProviderTransport
} from './providers/http-provider';
import { createMockProvider } from './providers/mock-provider';
import { createProviderRegistry } from './providers/provider-registry';

export class TranslationProviderError extends Error {
  readonly code = 'TRANSLATION_PROVIDER_FAILED';
  readonly provider: TranslationProviderKind;

  constructor(provider: TranslationProviderKind, message: string) {
    super(message);
    this.name = 'TranslationProviderError';
    this.provider = provider;
  }
}

export interface TranslationProviderService {
  translate(input: TranslateInput): Promise<TranslationResult>;
}

export interface TranslateInput {
  providerKind: TranslationProviderKind;
  request: TranslationRequest;
}

export interface CreateTranslationProviderServiceOptions {
  providers?: TranslationProvider[];
  httpProviderSettings?: ProviderSettings;
  httpTransport?: HttpProviderTransport;
}

export function createTranslationProviderService(
  options: CreateTranslationProviderServiceOptions = {}
): TranslationProviderService {
  const registry = createProviderRegistry(
    options.providers ?? createDefaultProviders(options.httpProviderSettings, options.httpTransport)
  );

  return {
    async translate({ providerKind, request }: TranslateInput): Promise<TranslationResult> {
      try {
        return await registry.get(providerKind).translate(request);
      } catch (error) {
        throw new TranslationProviderError(
          providerKind,
          error instanceof Error ? error.message : 'Unknown translation provider failure.'
        );
      }
    }
  };
}

function createDefaultProviders(
  httpProviderSettings?: ProviderSettings,
  httpTransport?: HttpProviderTransport
): TranslationProvider[] {
  const providers: TranslationProvider[] = [createMockProvider()];

  if (httpProviderSettings) {
    providers.push(
      createHttpProvider({
        settings: httpProviderSettings,
        transport: httpTransport
      })
    );
  }

  return providers;
}
