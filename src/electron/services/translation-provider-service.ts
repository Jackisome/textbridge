import type { ProviderId } from '../../shared/types/provider';
import type { TranslationRequest, TranslationResult } from '../../core/entities/translation';
import { createProviderConfigError } from './providers/provider-errors';
import type { ProviderRegistry } from './providers/provider-registry';
import { renderPrompt } from '../../shared/utils/prompt-template';
import type { TranslationClientSettings } from '../../shared/types/settings';

export interface TranslationProviderService {
  getAvailableProviders: () => ProviderId[];
  translateWithSettings: {
    (input: {
      text: string;
      settings: TranslationClientSettings;
    }): Promise<TranslationResult>;
    (
      settings: TranslationClientSettings,
      request: TranslationRequest
    ): Promise<TranslationResult>;
  };
}

interface CreateTranslationProviderServiceOptions {
  registry: ProviderRegistry;
  fetch?: typeof globalThis.fetch;
}

function buildPrompt(
  settings: TranslationClientSettings,
  request: Pick<TranslationRequest, 'text' | 'instructions' | 'targetLanguage'>
) {
  const providerSettings = settings.providers[settings.activeProviderId];

  if ('userPromptTemplate' in providerSettings) {
    const baseUserPrompt = renderPrompt(providerSettings.userPromptTemplate, {
      origin: request.text,
      to: request.targetLanguage
    });

    return {
      system: 'systemPrompt' in providerSettings ? providerSettings.systemPrompt : undefined,
      user:
        request.instructions === undefined
          ? baseUserPrompt
          : `${baseUserPrompt}\n\nAdditional instructions:\n${request.instructions}`
    };
  }

  return {
    user:
      request.instructions === undefined
        ? request.text
        : `${request.text}\n\nAdditional instructions:\n${request.instructions}`
  };
}

export function createTranslationProviderService(
  options: CreateTranslationProviderServiceOptions
): TranslationProviderService {
  async function translateWithNormalizedRequest(
    settings: TranslationClientSettings,
    request: TranslationRequest
  ): Promise<TranslationResult> {
    if (request.text.trim().length === 0) {
      throw createProviderConfigError('Translation text cannot be empty.');
    }

    const provider = options.registry.get(settings.activeProviderId);

    if (provider === undefined) {
      throw createProviderConfigError(
        `Provider "${settings.activeProviderId}" is not registered.`
      );
    }

    const controller = new AbortController();
    const providerResult = await provider.translate({
      providerId: settings.activeProviderId,
      text: request.text,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      providerSettings: settings.providers[settings.activeProviderId],
      prompt: buildPrompt(settings, request),
      signal: controller.signal,
      fetch: options.fetch ?? globalThis.fetch
    });

    return {
      translatedText: providerResult.text,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      detectedSourceLanguage: providerResult.detectedSourceLanguage,
      provider: settings.activeProviderId
    };
  }

  return {
    getAvailableProviders() {
      return options.registry.list().map((provider) => provider.id);
    },
    async translateWithSettings(
      inputOrSettings:
        | {
            text: string;
            settings: TranslationClientSettings;
          }
        | TranslationClientSettings,
      maybeRequest?: TranslationRequest
    ) {
      if (maybeRequest !== undefined) {
        return translateWithNormalizedRequest(
          inputOrSettings as TranslationClientSettings,
          maybeRequest
        );
      }

      if (!('settings' in inputOrSettings)) {
        throw createProviderConfigError('A translation request is required.');
      }

      const { settings, text } = inputOrSettings;

      return translateWithNormalizedRequest(settings, {
        text,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        outputMode: settings.outputMode
      });
    }
  };
}
