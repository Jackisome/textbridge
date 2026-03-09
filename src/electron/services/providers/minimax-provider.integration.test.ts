// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { defaultTranslationClientSettings } from '../../../shared/constants/default-settings';
import { loadMiniMaxLiveTestConfig } from './minimax-live-test-config';
import { createMinimaxProvider } from './minimax-provider';

const liveConfig = loadMiniMaxLiveTestConfig();
const liveIt = liveConfig === null ? it.skip : it;

describe('createMinimaxProvider live integration', () => {
  liveIt('can call the real minimax endpoint with environment configuration', async () => {
    const config = liveConfig;

    const provider = createMinimaxProvider();
    const result = await provider.translate({
      providerId: 'minimax',
      text: config!.text,
      sourceLanguage: config!.sourceLanguage,
      targetLanguage: config!.targetLanguage,
      providerSettings: {
        ...defaultTranslationClientSettings.providers.minimax,
        apiKey: config!.apiKey,
        model: config!.model,
        baseUrl: config!.baseUrl
      },
      prompt: {
        system: defaultTranslationClientSettings.providers.minimax.systemPrompt,
        user: `Translate ${config!.text} to ${config!.targetLanguage}`
      },
      signal: new AbortController().signal,
      fetch: globalThis.fetch
    });

    expect(result.text.trim().length).toBeGreaterThan(0);
  });
});
