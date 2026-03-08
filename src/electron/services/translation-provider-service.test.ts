// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import { createProviderRegistry } from './providers/provider-registry';
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

    expect(result.text).toContain('Hello world');
  });
});
