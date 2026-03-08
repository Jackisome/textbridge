// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createTongyiProvider } from './tongyi-provider';

describe('createTongyiProvider', () => {
  it('uses the compatible request body for standard models', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'Tongyi output'
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

    const provider = createTongyiProvider();

    const result = await provider.translate({
      providerId: 'tongyi',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'tongyi-key',
        model: 'qwen-plus',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
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

    expect(JSON.parse(String(request?.body)).model).toBe('qwen-plus');
    expect(result.text).toBe('Tongyi output');
  });

  it('uses the translation-specific request body for qwen-mt models', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: {
            translated_text: 'Tongyi MT output'
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

    const provider = createTongyiProvider();

    await provider.translate({
      providerId: 'tongyi',
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        apiKey: 'tongyi-key',
        model: 'qwen-mt-turbo',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
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
    const mtBody = JSON.parse(String(request?.body));

    expect(mtBody.translation_options.target_lang).toBe('zh');
  });
});
