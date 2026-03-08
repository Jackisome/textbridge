// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createGeminiProvider } from './gemini-provider';

describe('createGeminiProvider', () => {
  it('calls generateContent and parses the candidate text', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Gemini output'
                  }
                ]
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

    const provider = createGeminiProvider();

    const result = await provider.translate({
      providerId: 'gemini',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'gemini-key',
        model: 'gemini-2.0-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        userPromptTemplate: 'Translate {{origin}} to {{to}}',
        timeoutMs: 20000
      },
      prompt: {
        user: 'Translate Hello world to zh-CN'
      },
      signal: new AbortController().signal,
      fetch: fetchMock
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);

    expect(url).toContain(':generateContent');
    expect(result.text).toBe('Gemini output');
  });
});
