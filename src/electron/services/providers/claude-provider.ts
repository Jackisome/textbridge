import {
  createProviderAuthError,
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import type { TranslationProvider } from './types';

interface ClaudeResponse {
  content?: Array<{
    text?: string;
  }>;
}

export function createClaudeProvider(): TranslationProvider<'claude'> {
  return {
    id: 'claude',
    async translate(context) {
      try {
        const response = await context.fetch(context.providerSettings.baseUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': context.providerSettings.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: context.providerSettings.model,
            system: context.prompt.system,
            max_tokens: 2048,
            messages: [
              {
                role: 'user',
                content: context.prompt.user
              }
            ]
          }),
          signal: context.signal
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 401 || response.status === 403) {
            throw createProviderAuthError(errorText || 'Claude authentication failed.', {
              status: response.status
            });
          }

          throw createProviderResponseError(errorText || 'Claude request failed.', {
            status: response.status
          });
        }

        const payload = (await response.json()) as ClaudeResponse;
        const text = payload.content?.[0]?.text?.trim() ?? '';

        if (text.length === 0) {
          throw createProviderResponseError('Claude returned an empty response.');
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

        throw createProviderNetworkError('Claude request failed due to a network error.', {
          cause: error
        });
      }
    }
  };
}
