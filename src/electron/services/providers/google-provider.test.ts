// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createGoogleProvider } from './google-provider';

describe('createGoogleProvider', () => {
  it('calls the google translate endpoint with a GET request and joins translated segments', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          [
            ['你好', 'Hello', null, null, 1],
            ['世界', 'world', null, null, 1]
          ],
          null,
          'en'
        ]),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    const provider = createGoogleProvider();

    const result = await provider.translate({
      providerId: 'google',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        baseUrl: 'https://translate.googleapis.com/translate_a/single',
        timeoutMs: 20000
      },
      prompt: {
        user: 'Hello world'
      },
      signal: new AbortController().signal,
      fetch: fetchMock
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('translate_a/single'),
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.text).toBe('你好世界');
  });
});
