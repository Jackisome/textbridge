import {
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import type { TranslationProvider } from './types';

type GoogleTranslateResponse = [Array<[string, string?, unknown?, unknown?, number?]>, unknown?, string?];

function mapGoogleLanguage(language: string): string {
  switch (language) {
    case 'zh-CN':
      return 'zh-CN';
    default:
      return language;
  }
}

export function createGoogleProvider(): TranslationProvider<'google'> {
  return {
    id: 'google',
    async translate(context) {
      const requestUrl = new URL(context.providerSettings.baseUrl);
      requestUrl.searchParams.set('client', 'gtx');
      requestUrl.searchParams.set('sl', mapGoogleLanguage(context.sourceLanguage));
      requestUrl.searchParams.set('tl', mapGoogleLanguage(context.targetLanguage));
      requestUrl.searchParams.set('dt', 't');
      requestUrl.searchParams.set('q', context.text);

      try {
        const response = await context.fetch(requestUrl.toString(), {
          method: 'GET',
          signal: context.signal
        });

        if (!response.ok) {
          throw createProviderResponseError('Google translation request failed.', {
            status: response.status
          });
        }

        const payload = (await response.json()) as GoogleTranslateResponse;
        const text =
          payload[0]
            ?.map((entry) => entry[0] ?? '')
            .join('')
            .trim() ?? '';

        if (text.length === 0) {
          throw createProviderResponseError('Google returned an empty translation response.');
        }

        return {
          text,
          detectedSourceLanguage: payload[2],
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

        throw createProviderNetworkError('Google translation failed due to a network error.', {
          cause: error
        });
      }
    }
  };
}
