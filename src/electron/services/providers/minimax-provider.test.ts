// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  createProviderAuthError,
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import { createMinimaxProvider } from './minimax-provider';

describe('createMinimaxProvider', () => {
  it('uses the model-specific endpoint and parses the translated text', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'MiniMax output'
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    const provider = createMinimaxProvider();

    const result = await provider.translate({
      providerId: 'minimax',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'minimax-key',
        model: 'MiniMax-Text-01',
        baseUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
        systemPrompt: 'system',
        userPromptTemplate: 'Translate {{origin}} to {{to}}',
        timeoutMs: 20000
      },
      prompt: {
        system: 'system',
        user: 'Translate Hello world to zh-CN'
      },
      signal: new AbortController().signal,
      fetch: fetchMock
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    const headers = request?.headers as Record<string, string>;

    expect(url).toBe('https://api.minimaxi.com/v1/text/chatcompletion_v2');
    expect(headers.authorization).toBe('Bearer minimax-key');
    expect(body.model).toBe('MiniMax-Text-01');
    expect(body.messages).toEqual([
      {
        role: 'system',
        name: 'MiniMax AI',
        content: 'system'
      },
      {
        role: 'user',
        name: 'User',
        content: 'Translate Hello world to zh-CN'
      }
    ]);
    expect(body.temperature).toBeUndefined();
    expect(result.text).toBe('MiniMax output');
  });

  describe('error handling', () => {
    it('throws ProviderAuthError on 401 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('', { status: 401 })
      );

      const provider = createMinimaxProvider();

      await expect(
        provider.translate({
          providerId: 'minimax',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'minimax-key',
            model: 'MiniMax-Text-01',
            baseUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
            systemPrompt: 'system',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            system: 'system',
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow('MiniMax authentication failed.');
    });

    it('throws ProviderAuthError on 403 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('', { status: 403 })
      );

      const provider = createMinimaxProvider();

      await expect(
        provider.translate({
          providerId: 'minimax',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'minimax-key',
            model: 'MiniMax-Text-01',
            baseUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
            systemPrompt: 'system',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            system: 'system',
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow('MiniMax authentication failed.');
    });

    it('throws ProviderResponseError on 500 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('', { status: 500 })
      );

      const provider = createMinimaxProvider();

      await expect(
        provider.translate({
          providerId: 'minimax',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'minimax-key',
            model: 'MiniMax-Text-01',
            baseUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
            systemPrompt: 'system',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            system: 'system',
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow('MiniMax request failed.');
    });

    it('throws ProviderNetworkError on network failure', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      const provider = createMinimaxProvider();

      await expect(
        provider.translate({
          providerId: 'minimax',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'minimax-key',
            model: 'MiniMax-Text-01',
            baseUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
            systemPrompt: 'system',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            system: 'system',
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow('MiniMax request failed due to a network error.');
    });

    it('throws ProviderResponseError on empty translation response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{}]
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        )
      );

      const provider = createMinimaxProvider();

      await expect(
        provider.translate({
          providerId: 'minimax',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'minimax-key',
            model: 'MiniMax-Text-01',
            baseUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
            systemPrompt: 'system',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            system: 'system',
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow('MiniMax returned an empty translation response.');
    });

    it('re-throws ProviderError on known error', async () => {
      class KnownProviderError extends Error {
        code = 'PROVIDER_ERROR' as const;
      }

      const knownError = new KnownProviderError('Known error');
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(knownError);

      const provider = createMinimaxProvider();

      await expect(
        provider.translate({
          providerId: 'minimax',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'minimax-key',
            model: 'MiniMax-Text-01',
            baseUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
            systemPrompt: 'system',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            system: 'system',
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow('Known error');
    });
  });
});
