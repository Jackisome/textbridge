// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { renderPrompt } from '../../../shared/utils/prompt-template';
import { createProviderConfigError, createProviderResponseError } from './provider-errors';
import type {
  ProviderExecutionContext,
  ProviderTranslationResult,
  TranslationProvider
} from './types';

describe('provider shared types', () => {
  it('renders prompt templates with the shared placeholders', () => {
    expect(
      renderPrompt('Translate {{origin}} to {{to}}', {
        origin: 'hello',
        to: 'zh-CN'
      })
    ).toBe('Translate hello to zh-CN');
  });

  it('creates structured provider errors', () => {
    expect(createProviderConfigError('missing key').code).toBe('PROVIDER_CONFIG_ERROR');
    expect(createProviderResponseError('empty output').code).toBe('PROVIDER_RESPONSE_ERROR');
  });

  it('supports the shared translation provider contract', async () => {
    const provider: TranslationProvider<'mock'> = {
      id: 'mock',
      async translate(context: ProviderExecutionContext<'mock'>): Promise<ProviderTranslationResult> {
        return {
          text: renderPrompt('{{origin}} -> {{to}}', {
            origin: context.text,
            to: context.targetLanguage
          }),
          raw: {
            providerId: context.providerId
          }
        };
      }
    };

    const result = await provider.translate({
      providerId: 'mock',
      text: 'hello',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      providerSettings: {
        prefix: '[Mock] ',
        latencyMs: 0
      },
      prompt: {
        system: '',
        user: '{{origin}} -> {{to}}'
      },
      signal: new AbortController().signal,
      fetch: globalThis.fetch
    });

    expect(result.text).toBe('hello -> zh-CN');
    expect(result.raw).toEqual({
      providerId: 'mock'
    });
  });
});
