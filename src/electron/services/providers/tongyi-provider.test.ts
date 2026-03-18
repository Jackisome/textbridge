import {
  createProviderAuthError,
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import type { TranslationProvider } from './types';

import { createTongyiProvider } from './tongyi-provider';

import { describe, expect, it, vi } from 'vitest';

describe('createTongyiProvider', () => {
  it('uses the compatible request body for standard models', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'Tongyi output'
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

    const provider = createTongyiProvider();

    const result = await provider.translate({
      providerId: 'tongyi',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'tongyi-key',
        model: 'qwen-plus',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
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

    const request = fetchMock.mock.calls[0]?.[1];

    expect(JSON.parse(String(request?.body)).model).toBe('qwen-plus');
    expect(result.text).toBe('Tongyi output');
  });

  it('uses the translation-specific request body for qwen-mt models', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: {
            translated_text: 'Tongyi MT output'
          }
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    const provider = createTongyiProvider();

    await provider.translate({
      providerId: 'tongyi',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'tongyi-key',
        model: 'qwen-mt-turbo',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
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

    const request = fetchMock.mock.calls[0]?.[1];
    const mtBody = JSON.parse(String(request?.body));

    expect(mtBody.translation_options.target_lang).toBe('zh');
  });

  describe('error handling for qwen-mt model', () => {
    it('throws ProviderAuthError on 401 response', async () => {
      const fetchMock = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(new Response('', { status: 401 }));

      const provider = createTongyiProvider();

      await expect(
        provider.translate({
          providerId: 'tongyi',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'tongyi-key',
            model: 'qwen-mt-turbo',
            baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
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
      ).rejects.toThrow(createProviderAuthError('Tongyi authentication failed.', { status: 401 }));
    });

    it('throws ProviderAuthError on 403 response', async () => {
      const fetchMock = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(new Response('', { status: 403 }));

      const provider = createTongyiProvider();

      await expect(
        provider.translate({
          providerId: 'tongyi',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'tongyi-key',
            model: 'qwen-mt-turbo',
            baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
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
      ).rejects.toThrow(createProviderAuthError('Tongyi authentication failed.', { status: 403 }));
    });

    it('throws ProviderNetworkError on network failure', async () => {
      const networkError = new Error('Network connection failed');
      const fetchMock = vi
        .fn<typeof globalThis.fetch>()
        .mockRejectedValueOnce(networkError);

      const provider = createTongyiProvider();

      await expect(
        provider.translate({
          providerId: 'tongyi',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'tongyi-key',
            model: 'qwen-mt-turbo',
            baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
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
      ).rejects.toThrow(createProviderNetworkError('Tongyi request failed due to a network error.'));
    });

    it('throws ProviderResponseError on empty translation response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: {
              translated_text: ''
            }
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        )
      );

      const provider = createTongyiProvider();

      await expect(
        provider.translate({
          providerId: 'tongyi',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'tongyi-key',
            model: 'qwen-mt-turbo',
            baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
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
      ).rejects.toThrow(
        createProviderResponseError('Tongyi returned an empty translation response.')
      );
    });

    it('throws ProviderResponseError on non-ok response', async () => {
      const fetchMock = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }));

      const provider = createTongyiProvider();

      await expect(
        provider.translate({
          providerId: 'tongyi',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'tongyi-key',
            model: 'qwen-mt-turbo',
            baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
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
      ).rejects.toThrow(createProviderResponseError('Service unavailable', { status: 503 }));
    });
  });

  describe('error handling for standard models (OpenAI-compatible)', () => {
    it('throws ProviderAuthError on 401 response', async () => {
      const fetchMock = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(new Response('', { status: 401 }));

      const provider = createTongyiProvider();

      await expect(
        provider.translate({
          providerId: 'tongyi',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'tongyi-key',
            model: 'qwen-plus',
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
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
      ).rejects.toThrow(createProviderAuthError('Provider authentication failed.', { status: 401 }));
    });

    it('throws ProviderAuthError on 403 response', async () => {
      const fetchMock = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(new Response('', { status: 403 }));

      const provider = createTongyiProvider();

      await expect(
        provider.translate({
          providerId: 'tongyi',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'tongyi-key',
            model: 'qwen-plus',
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
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
      ).rejects.toThrow(createProviderAuthError('Provider authentication failed.', { status: 403 }));
    });

    it('throws ProviderNetworkError on network failure', async () => {
      const networkError = new Error('Network connection failed');
      const fetchMock = vi
        .fn<typeof globalThis.fetch>()
        .mockRejectedValueOnce(networkError);

      const provider = createTongyiProvider();

      await expect(
        provider.translate({
          providerId: 'tongyi',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'tongyi-key',
            model: 'qwen-plus',
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
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
      ).rejects.toThrow(createProviderNetworkError('Provider request failed due to a network error.'));
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

      const provider = createTongyiProvider();

      await expect(
        provider.translate({
          providerId: 'tongyi',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'tongyi-key',
            model: 'qwen-plus',
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
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
      ).rejects.toThrow(
        createProviderResponseError('Provider returned an empty translation response.')
      );
    });

    it('throws ProviderResponseError on non-ok response', async () => {
      const fetchMock = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }));

      const provider = createTongyiProvider();

      await expect(
        provider.translate({
          providerId: 'tongyi',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'tongyi-key',
            model: 'qwen-plus',
            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
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
      ).rejects.toThrow(createProviderResponseError('Service unavailable', { status: 503 }));
    });
  });
});
