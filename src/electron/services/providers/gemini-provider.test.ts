// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  createProviderAuthError,
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import { createGeminiProvider } from './gemini-provider';

describe('createGeminiProvider', () => {
  it('calls generateContent and parses the candidate text', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Gemini output'
                  }
                ]
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

    const provider = createGeminiProvider();

    const result = await provider.translate({
      providerId: 'gemini',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'gemini-key',
        model: 'gemini-2.0-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        userPromptTemplate: 'Translate {{origin}} to {{to}}',
        timeoutMs: 20000
      },
      prompt: {
        user: 'Translate Hello world to zh-CN'
      },
      signal: new AbortController().signal,
      fetch: fetchMock
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);

    expect(url).toContain(':generateContent');
    expect(result.text).toBe('Gemini output');
  });

  describe('error handling', () => {
    it('throws ProviderAuthError on 401 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      const provider = createGeminiProvider();

      await expect(
        provider.translate({
          providerId: 'gemini',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'gemini-key',
            model: 'gemini-2.0-flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow(createProviderAuthError('Unauthorized', { status: 401 }));
    });

    it('throws ProviderAuthError on 403 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('Forbidden', { status: 403 })
      );

      const provider = createGeminiProvider();

      await expect(
        provider.translate({
          providerId: 'gemini',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'gemini-key',
            model: 'gemini-2.0-flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow(createProviderAuthError('Forbidden', { status: 403 }));
    });

    it('throws ProviderResponseError on 500 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      );

      const provider = createGeminiProvider();

      await expect(
        provider.translate({
          providerId: 'gemini',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'gemini-key',
            model: 'gemini-2.0-flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow(createProviderResponseError('Internal Server Error', { status: 500 }));
    });

    it('throws ProviderNetworkError on network failure', async () => {
      const fetchMock = vi
        .fn<typeof globalThis.fetch>()
        .mockRejectedValueOnce(new Error('network error'));

      const provider = createGeminiProvider();

      await expect(
        provider.translate({
          providerId: 'gemini',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'gemini-key',
            model: 'gemini-2.0-flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow(createProviderNetworkError('Gemini request failed due to a network error.'));
    });

    it('throws ProviderResponseError on empty translation response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: ''
                    }
                  ]
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

      const provider = createGeminiProvider();

      await expect(
        provider.translate({
          providerId: 'gemini',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'gemini-key',
            model: 'gemini-2.0-flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            userPromptTemplate: 'Translate {{origin}} to {{to}}',
            timeoutMs: 20000
          },
          prompt: {
            user: 'Translate Hello world to zh-CN'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow(createProviderResponseError('Gemini returned an empty response.'));
    });
  });
});
