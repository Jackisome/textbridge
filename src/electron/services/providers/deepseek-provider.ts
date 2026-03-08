import { translateWithOpenAiCompatibleApi } from './openai-compatible-provider';
import type { TranslationProvider } from './types';

export function createDeepseekProvider(): TranslationProvider<'deepseek'> {
  return {
    id: 'deepseek',
    async translate(context) {
      return translateWithOpenAiCompatibleApi({
        apiKey: context.providerSettings.apiKey,
        baseUrl: context.providerSettings.baseUrl,
        model: context.providerSettings.model,
        systemPrompt: context.prompt.system,
        userPrompt: context.prompt.user,
        signal: context.signal,
        fetch: context.fetch,
        temperature: context.providerSettings.model === 'deepseek-reasoner' ? undefined : 0
      });
    }
  };
}
