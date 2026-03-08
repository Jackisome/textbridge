import type { TranslationProvider } from '../../../core/contracts';

export function createMockProvider(): TranslationProvider {
  return {
    kind: 'mock',
    async translate(request) {
      return {
        translatedText: `[mock:${request.targetLanguage}] ${request.text}`,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        provider: 'mock'
      };
    }
  };
}
