// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createClaudeProvider } from './claude-provider';

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
});
