// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

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
});
