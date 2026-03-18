// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createClaudeProvider } from './claude-provider';
import {
  ProviderAuthError,
  ProviderNetworkError,
  ProviderResponseError
} from './provider-errors';

describe('createClaudeProvider', () => {
  it('sends anthropic headers and parses content text', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              text: 'Claude output'
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

    const provider = createClaudeProvider();

    const result = await provider.translate({
      providerId: 'claude',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'claude-key',
        model: 'claude-3-5-haiku-latest',
        baseUrl: 'https://api.anthropic.com/v1/messages',
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
    const headers = request?.headers as Record<string, string>;

    expect(headers['x-api-key']).toBe('claude-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(result.text).toBe('Claude output');
  });

  describe('error handling', () => {
    it('throws ProviderAuthError on 401 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('Unauthorized', {
          status: 401,
          headers: { 'content-type': 'text/plain' }
        })
      );

      const provider = createClaudeProvider();

      await expect(
        provider.translate({
          providerId: 'claude',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'claude-key',
            model: 'claude-3-5-haiku-latest',
            baseUrl: 'https://api.anthropic.com/v1/messages',
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
      ).rejects.toBeInstanceOf(ProviderAuthError);
    });

    it('throws ProviderAuthError on 403 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('Forbidden', {
          status: 403,
          headers: { 'content-type': 'text/plain' }
        })
      );

      const provider = createClaudeProvider();

      await expect(
        provider.translate({
          providerId: 'claude',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'claude-key',
            model: 'claude-3-5-haiku-latest',
            baseUrl: 'https://api.anthropic.com/v1/messages',
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
      ).rejects.toBeInstanceOf(ProviderAuthError);
    });

    it('throws ProviderResponseError on 500 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('Internal Server Error', {
          status: 500,
          headers: { 'content-type': 'text/plain' }
        })
      );

      const provider = createClaudeProvider();

      await expect(
        provider.translate({
          providerId: 'claude',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'claude-key',
            model: 'claude-3-5-haiku-latest',
            baseUrl: 'https://api.anthropic.com/v1/messages',
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
      ).rejects.toBeInstanceOf(ProviderResponseError);
    });

    it('throws ProviderNetworkError on network failure', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      const provider = createClaudeProvider();

      await expect(
        provider.translate({
          providerId: 'claude',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'claude-key',
            model: 'claude-3-5-haiku-latest',
            baseUrl: 'https://api.anthropic.com/v1/messages',
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
      ).rejects.toBeInstanceOf(ProviderNetworkError);
    });

    it('throws ProviderResponseError on empty translation response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              {
                text: ''
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

      const provider = createClaudeProvider();

      await expect(
        provider.translate({
          providerId: 'claude',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            apiKey: 'claude-key',
            model: 'claude-3-5-haiku-latest',
            baseUrl: 'https://api.anthropic.com/v1/messages',
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
      ).rejects.toBeInstanceOf(ProviderResponseError);
    });
  });
});
