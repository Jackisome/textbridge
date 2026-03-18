// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  createProviderAuthError,
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import { createTencentProvider } from './tencent-provider';

describe('createTencentProvider', () => {
  it('signs the TextTranslate request and parses the translated text', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          Response: {
            TargetText: '腾讯翻译'
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

    const provider = createTencentProvider({
      now: () => new Date('2026-03-09T00:00:00.000Z')
    });

    const result = await provider.translate({
      providerId: 'tencent',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        secretId: 'secret-id',
        secretKey: 'secret-key',
        region: 'ap-beijing',
        baseUrl: 'https://tmt.tencentcloudapi.com',
        timeoutMs: 20000
      },
      prompt: {
        user: 'Hello world'
      },
      signal: new AbortController().signal,
      fetch: fetchMock
    });

    const request = fetchMock.mock.calls[0]?.[1];
    const headers = request?.headers as Record<string, string>;

    expect(headers['X-TC-Action']).toBe('TextTranslate');
    expect(headers.Authorization).toContain('TC3-HMAC-SHA256');
    expect(result.text).toBe('腾讯翻译');
  });

  describe('error handling', () => {
    it('throws ProviderAuthError on 401 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('', { status: 401 })
      );

      const provider = createTencentProvider({
        now: () => new Date('2026-03-09T00:00:00.000Z')
      });

      await expect(
        provider.translate({
          providerId: 'tencent',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            secretId: 'secret-id',
            secretKey: 'secret-key',
            region: 'ap-beijing',
            baseUrl: 'https://tmt.tencentcloudapi.com',
            timeoutMs: 20000
          },
          prompt: {
            user: 'Hello world'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow(createProviderAuthError('Tencent authentication failed.', { status: 401 }));
    });

    it('throws ProviderAuthError on 403 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('', { status: 403 })
      );

      const provider = createTencentProvider({
        now: () => new Date('2026-03-09T00:00:00.000Z')
      });

      await expect(
        provider.translate({
          providerId: 'tencent',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            secretId: 'secret-id',
            secretKey: 'secret-key',
            region: 'ap-beijing',
            baseUrl: 'https://tmt.tencentcloudapi.com',
            timeoutMs: 20000
          },
          prompt: {
            user: 'Hello world'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow(createProviderAuthError('Tencent authentication failed.', { status: 403 }));
    });

    it('throws ProviderResponseError on 500 response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response('', { status: 500 })
      );

      const provider = createTencentProvider({
        now: () => new Date('2026-03-09T00:00:00.000Z')
      });

      await expect(
        provider.translate({
          providerId: 'tencent',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            secretId: 'secret-id',
            secretKey: 'secret-key',
            region: 'ap-beijing',
            baseUrl: 'https://tmt.tencentcloudapi.com',
            timeoutMs: 20000
          },
          prompt: {
            user: 'Hello world'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow(createProviderResponseError('Tencent request failed.', { status: 500 }));
    });

    it('throws ProviderNetworkError on network failure', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(
        new TypeError('fetch failed')
      );

      const provider = createTencentProvider({
        now: () => new Date('2026-03-09T00:00:00.000Z')
      });

      await expect(
        provider.translate({
          providerId: 'tencent',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            secretId: 'secret-id',
            secretKey: 'secret-key',
            region: 'ap-beijing',
            baseUrl: 'https://tmt.tencentcloudapi.com',
            timeoutMs: 20000
          },
          prompt: {
            user: 'Hello world'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow(createProviderNetworkError('Tencent translation failed due to a network error.'));
    });

    it('throws ProviderResponseError on empty translation response', async () => {
      const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Response: {}
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        )
      );

      const provider = createTencentProvider({
        now: () => new Date('2026-03-09T00:00:00.000Z')
      });

      await expect(
        provider.translate({
          providerId: 'tencent',
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          providerSettings: {
            secretId: 'secret-id',
            secretKey: 'secret-key',
            region: 'ap-beijing',
            baseUrl: 'https://tmt.tencentcloudapi.com',
            timeoutMs: 20000
          },
          prompt: {
            user: 'Hello world'
          },
          signal: new AbortController().signal,
          fetch: fetchMock
        })
      ).rejects.toThrow(createProviderResponseError('Tencent returned an empty translation response.'));
    });
  });
});
