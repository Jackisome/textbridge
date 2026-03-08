import { createProviderConfigError } from './provider-errors';
import { translateWithOpenAiCompatibleApi } from './openai-compatible-provider';
import type { TranslationProvider } from './types';

export function createCustomProvider(): TranslationProvider<'custom'> {
  return {
    id: 'custom',
    async translate(context) {
      if (context.providerSettings.requestFormat !== 'openai-chat') {
        throw createProviderConfigError(
          `Unsupported custom request format: ${context.providerSettings.requestFormat}`
        );
      }

      return translateWithOpenAiCompatibleApi({
        apiKey: context.providerSettings.apiKey,
        baseUrl: context.providerSettings.baseUrl,
        model: context.providerSettings.model,
        systemPrompt: context.prompt.system,
        userPrompt: context.prompt.user,
        signal: context.signal,
        fetch: context.fetch,
        temperature: 0
      });
    }
  };
}
