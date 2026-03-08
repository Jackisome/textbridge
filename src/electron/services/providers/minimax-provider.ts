import { translateWithOpenAiCompatibleApi } from './openai-compatible-provider';
import type { TranslationProvider } from './types';

export function createMinimaxProvider(): TranslationProvider<'minimax'> {
  return {
    id: 'minimax',
    async translate(context) {
      return translateWithOpenAiCompatibleApi({
        apiKey: context.providerSettings.apiKey,
        baseUrl: `${context.providerSettings.baseUrl}/${encodeURIComponent(
          context.providerSettings.model
        )}`,
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
