import {
  createProviderAuthError,
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import { translateWithOpenAiCompatibleApi } from './openai-compatible-provider';
import type { TranslationProvider } from './types';

interface TongyiMtResponse {
  output?: {
    translated_text?: string;
  };
}

function mapTongyiLanguage(language: string): string {
  switch (language) {
    case 'zh-CN':
      return 'zh';
    default:
      return language;
  }
}

export function createTongyiProvider(): TranslationProvider<'tongyi'> {
  return {
    id: 'tongyi',
    async translate(context) {
      if (!context.providerSettings.model.startsWith('qwen-mt-')) {
        return translateWithOpenAiCompatibleApi({
          apiKey: context.providerSettings.apiKey,
          baseUrl: context.providerSettings.baseUrl,
          model: context.providerSettings.model,
          systemPrompt: context.prompt.system,
          userPrompt: context.prompt.user,
          signal: context.signal,
          fetch: context.fetch
        });
      }

      try {
        const response = await context.fetch(context.providerSettings.baseUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${context.providerSettings.apiKey}`
          },
          body: JSON.stringify({
            model: context.providerSettings.model,
            input: {
              source_text: context.text
            },
            translation_options: {
              source_lang: mapTongyiLanguage(context.sourceLanguage),
              target_lang: mapTongyiLanguage(context.targetLanguage)
            }
          }),
          signal: context.signal
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 401 || response.status === 403) {
            throw createProviderAuthError(errorText || 'Tongyi authentication failed.', {
              status: response.status
            });
          }

          throw createProviderResponseError(errorText || 'Tongyi request failed.', {
            status: response.status
          });
        }

        const payload = (await response.json()) as TongyiMtResponse;
        const text = payload.output?.translated_text?.trim() ?? '';

        if (text.length === 0) {
          throw createProviderResponseError('Tongyi returned an empty translation response.');
        }

        return {
          text,
          raw: payload
        };
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          typeof (error as { code?: unknown }).code === 'string'
        ) {
          throw error;
        }

        throw createProviderNetworkError('Tongyi request failed due to a network error.', {
          cause: error
        });
      }
    }
  };
}
