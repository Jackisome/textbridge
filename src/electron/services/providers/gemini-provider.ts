import {
  createProviderAuthError,
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import type { TranslationProvider } from './types';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export function createGeminiProvider(): TranslationProvider<'gemini'> {
  return {
    id: 'gemini',
    async translate(context) {
      const requestUrl = `${context.providerSettings.baseUrl}/${encodeURIComponent(
        context.providerSettings.model
      )}:generateContent?key=${encodeURIComponent(context.providerSettings.apiKey)}`;

      try {
        const response = await context.fetch(requestUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            ...(context.prompt.system === undefined
              ? {}
              : {
                  systemInstruction: {
                    parts: [{ text: context.prompt.system }]
                  }
                }),
            contents: [
              {
                role: 'user',
                parts: [{ text: context.prompt.user }]
              }
            ]
          }),
          signal: context.signal
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 401 || response.status === 403) {
            throw createProviderAuthError(errorText || 'Gemini authentication failed.', {
              status: response.status
            });
          }

          throw createProviderResponseError(errorText || 'Gemini request failed.', {
            status: response.status
          });
        }

        const payload = (await response.json()) as GeminiResponse;
        const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

        if (text.length === 0) {
          throw createProviderResponseError('Gemini returned an empty response.');
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

        throw createProviderNetworkError('Gemini request failed due to a network error.', {
          cause: error
        });
      }
    }
  };
}
