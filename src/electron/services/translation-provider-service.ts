import type { ProviderId } from '../../shared/types/provider';
import { createProviderConfigError } from './providers/provider-errors';
import type { ProviderRegistry } from './providers/provider-registry';
import type { ProviderTranslationResult } from './providers/types';
import { renderPrompt } from '../../shared/utils/prompt-template';
import type { TranslationClientSettings } from '../../shared/types/settings';

export interface TranslationProviderService {
  getAvailableProviders: () => ProviderId[];
  translateWithSettings: (input: {
    text: string;
    settings: TranslationClientSettings;
  }) => Promise<ProviderTranslationResult>;
}

interface CreateTranslationProviderServiceOptions {
  registry: ProviderRegistry;
  fetch?: typeof globalThis.fetch;
}

function buildPrompt(settings: TranslationClientSettings, text: string) {
  const providerSettings = settings.providers[settings.activeProviderId];

  if ('userPromptTemplate' in providerSettings) {
    return {
      system: 'systemPrompt' in providerSettings ? providerSettings.systemPrompt : undefined,
      user: renderPrompt(providerSettings.userPromptTemplate, {
        origin: text,
        to: settings.targetLanguage
      })
    };
  }

  return {
    user: text
  };
}

export function createTranslationProviderService(
  options: CreateTranslationProviderServiceOptions
): TranslationProviderService {
  return {
    getAvailableProviders() {
      return options.registry.list().map((provider) => provider.id);
    },
    async translateWithSettings({ text, settings }) {
      if (text.trim().length === 0) {
        throw createProviderConfigError('Translation text cannot be empty.');
      }

      const provider = options.registry.get(settings.activeProviderId);

      if (provider === undefined) {
        throw createProviderConfigError(`Provider "${settings.activeProviderId}" is not registered.`);
      }

      const controller = new AbortController();

      return provider.translate({
        providerId: settings.activeProviderId,
        text,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        providerSettings: settings.providers[settings.activeProviderId],
        prompt: buildPrompt(settings, text),
        signal: controller.signal,
        fetch: options.fetch ?? globalThis.fetch
      });
    }
  };
}
