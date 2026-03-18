// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  ProviderAuthError,
  ProviderNetworkError,
  ProviderResponseError
} from './provider-errors';
import { createDeepseekProvider } from './deepseek-provider';

describe('createDeepseekProvider', () => {
  it('uses the deepseek chat endpoint and omits temperature for deepseek-reasoner', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'translated'
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

    const provider = createDeepseekProvider();

    await provider.translate({
      providerId: 'deepseek',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'deepseek-key',
        model: 'deepseek-reasoner',
        baseUrl: 'https://api.deepseek.com/chat/completions',
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

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST'
      })
    );

    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));

    expect(body.temperature).toBeUndefined();
  });

  describe('error handling', () => {
    const createTranslateContext = (fetchMock: ReturnType<typeof vi.fn>) => ({
      providerId: 'deepseek',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'deepseek-key',
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/chat/completions',
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

    it('throws ProviderAuthError on 401 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('', { status: 401 })
      );

      const provider = createDeepseekProvider();

      await expect(provider.translate(createTranslateContext(fetchMock))).rejects.toThrow(
        ProviderAuthError
      );
    });

    it('throws ProviderAuthError on 403 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('', { status: 403 })
      );

      const provider = createDeepseekProvider();

      await expect(provider.translate(createTranslateContext(fetchMock))).rejects.toThrow(
        ProviderAuthError
      );
    });

    it('throws ProviderResponseError on 500 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('', { status: 500 })
      );

      const provider = createDeepseekProvider();

      await expect(provider.translate(createTranslateContext(fetchMock))).rejects.toThrow(
        ProviderResponseError
      );
    });

    it('throws ProviderNetworkError on network failure', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      const provider = createDeepseekProvider();

      await expect(provider.translate(createTranslateContext(fetchMock))).rejects.toThrow(
        ProviderNetworkError
      );
    });

    it('throws ProviderResponseError on empty translation response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: ''
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

      const provider = createDeepseekProvider();

      await expect(provider.translate(createTranslateContext(fetchMock))).rejects.toThrow(
        ProviderResponseError
      );
    });
  });
});
