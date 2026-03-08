import { describe, expect, it } from 'vitest';
import type { TranslationRequest, TranslationResult } from '../../core/entities/translation';
import { createTranslationProviderService } from './translation-provider-service';

describe('createTranslationProviderService', () => {
  it('sends the normalized request to the selected provider and returns a normalized result', async () => {
    const request: TranslationRequest = {
      text: 'Hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      outputMode: 'replace-original'
    };

    let receivedRequest: TranslationRequest | null = null;

    const expectedResult: TranslationResult = {
      translatedText: '你好，世界',
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      detectedSourceLanguage: 'en',
      provider: 'mock'
    };

    const service = createTranslationProviderService({
      providers: [
        {
          kind: 'mock',
          translate: async (incomingRequest) => {
            receivedRequest = incomingRequest;
            return expectedResult;
          }
        }
      ]
    });

    await expect(
      service.translate({
        providerKind: 'mock',
        request
      })
    ).resolves.toEqual(expectedResult);

    expect(receivedRequest).toEqual(request);
  });

  it('normalizes provider failures', async () => {
    const service = createTranslationProviderService({
      providers: [
        {
          kind: 'mock',
          translate: async () => {
            throw new Error('upstream timeout');
          }
        }
      ]
    });

    await expect(
      service.translate({
        providerKind: 'mock',
        request: {
          text: 'Hello world',
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          outputMode: 'replace-original'
        }
      })
    ).rejects.toMatchObject({
      code: 'TRANSLATION_PROVIDER_FAILED',
      provider: 'mock',
      message: 'upstream timeout'
    });
  });
});
