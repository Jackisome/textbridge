// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

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
});
