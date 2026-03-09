import {
  createProviderAuthError,
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import type { TranslationProvider } from './types';

function normalizeMinimaxBaseUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);

    if (url.hostname === 'api.minimax.chat') {
      url.hostname = 'api.minimaxi.com';
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return baseUrl;
  }
}

interface MiniMaxResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export function createMinimaxProvider(): TranslationProvider<'minimax'> {
  return {
    id: 'minimax',
    async translate(context) {
      try {
        const response = await context.fetch(normalizeMinimaxBaseUrl(context.providerSettings.baseUrl), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${context.providerSettings.apiKey}`
          },
          body: JSON.stringify({
            model: context.providerSettings.model,
            messages: [
              ...(context.prompt.system === undefined || context.prompt.system.trim().length === 0
                ? []
                : [
                    {
                      role: 'system',
                      name: 'MiniMax AI',
                      content: context.prompt.system
                    }
                  ]),
              {
                role: 'user',
                name: 'User',
                content: context.prompt.user
              }
            ]
          }),
          signal: context.signal
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 401 || response.status === 403) {
            throw createProviderAuthError(errorText || 'MiniMax authentication failed.', {
              status: response.status
            });
          }

          throw createProviderResponseError(errorText || 'MiniMax request failed.', {
            status: response.status
          });
        }

        const payload = (await response.json()) as MiniMaxResponse;
        const text = payload.choices?.[0]?.message?.content?.trim() ?? '';

        if (text.length === 0) {
          throw createProviderResponseError('MiniMax returned an empty translation response.');
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

        throw createProviderNetworkError('MiniMax request failed due to a network error.', {
          cause: error
        });
      }
    }
  };
}
