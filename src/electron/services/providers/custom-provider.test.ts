// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createCustomProvider } from './custom-provider';

describe('createCustomProvider', () => {
  it('uses the configured base url and request format', async () => {
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

    const provider = createCustomProvider();

    const result = await provider.translate({
      providerId: 'custom',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'custom-key',
        model: 'gpt-4.1-mini',
        baseUrl: 'https://example.com/v1/chat/completions',
        requestFormat: 'openai-chat',
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

    const customRequest = fetchMock.mock.calls[0]?.[1];

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.com/v1/chat/completions');
    expect(String(customRequest?.body)).toContain('Translate');
    expect(result.text).toBe('translated');
  });
});
