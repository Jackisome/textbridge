// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

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

    expect(url).toContain('/v1/text/chatcompletion_v2');
    expect(result.text).toBe('MiniMax output');
  });
});
