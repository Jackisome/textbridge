// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { translateWithOpenAiCompatibleApi } from './openai-compatible-provider';

describe('translateWithOpenAiCompatibleApi', () => {
  it('posts a chat completions request and parses the translated text', async () => {
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

    const result = await translateWithOpenAiCompatibleApi({
      apiKey: 'deepseek-key',
      baseUrl: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
      systemPrompt: 'System prompt',
      userPrompt: 'Translate Hello world to zh-CN',
      signal: new AbortController().signal,
      fetch: fetchMock
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST'
      })
    );
    expect(result.text).toBe('translated');
  });
});
