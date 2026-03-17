// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import { createDefaultProviderRegistry, createProviderRegistry } from './providers/provider-registry';
import { createMockProvider } from './providers/mock-provider';
import { createTranslationProviderService } from './translation-provider-service';

describe('translation provider service', () => {
  it('registers and resolves the mock provider', () => {
    const registry = createProviderRegistry([createMockProvider()]);

    expect(registry.get('mock')?.id).toBe('mock');
  });

  it('translates text with the active provider settings', async () => {
    const service = createTranslationProviderService({
      registry: createProviderRegistry([createMockProvider()])
    });

    const result = await service.translateWithSettings({
      text: 'Hello world',
      settings: {
        ...defaultTranslationClientSettings,
        activeProviderId: 'mock'
      }
    });

    expect(result.translatedText).toContain('Hello world');
  });

  it('rejects empty text with a provider config error', async () => {
    const service = createTranslationProviderService({
      registry: createDefaultProviderRegistry()
    });

    await expect(
      service.translateWithSettings({
        text: '',
        settings: defaultTranslationClientSettings
      })
    ).rejects.toMatchObject({
      code: 'PROVIDER_CONFIG_ERROR'
    });
  });

  it('exposes the available provider identifiers', () => {
    const service = createTranslationProviderService({
      registry: createDefaultProviderRegistry()
    });

    expect(service.getAvailableProviders()).toEqual(
      expect.arrayContaining([
        'claude',
        'deepseek',
        'minimax',
        'gemini',
        'google',
        'tencent',
        'tongyi',
        'custom',
        'mock'
      ])
    );
  });
});
