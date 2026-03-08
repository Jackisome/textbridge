import type { TranslationProvider } from '../../../core/contracts';
import type { TranslationRequest, TranslationResult } from '../../../core/entities/translation';
import type { ProviderSettings } from '../../../shared/types/settings';

export interface HttpProviderTransport {
  send(
    request: TranslationRequest,
    settings: ProviderSettings
  ): Promise<Partial<TranslationResult> & Pick<TranslationResult, 'translatedText'>>;
}

export interface CreateHttpProviderOptions {
  settings: ProviderSettings;
  transport?: HttpProviderTransport;
}

export function createHttpProvider({
  settings,
  transport
}: CreateHttpProviderOptions): TranslationProvider {
  return {
    kind: 'http',
    async translate(request) {
      const response =
        transport !== undefined
          ? await transport.send(request, settings)
          : await sendWithFetch(request, settings);

      return {
        translatedText: response.translatedText,
        sourceLanguage: response.sourceLanguage ?? request.sourceLanguage,
        targetLanguage: response.targetLanguage ?? request.targetLanguage,
        detectedSourceLanguage: response.detectedSourceLanguage,
        provider: response.provider ?? 'http'
      };
    }
  };
}

async function sendWithFetch(
  request: TranslationRequest,
  settings: ProviderSettings
): Promise<Partial<TranslationResult> & Pick<TranslationResult, 'translatedText'>> {
  if (!settings.endpoint) {
    throw new Error('HTTP provider endpoint is not configured.');
  }

  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: settings.apiKey ? `Bearer ${settings.apiKey}` : ''
    },
    body: JSON.stringify({
      text: request.text,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      instructions: request.instructions
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP provider request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Partial<TranslationResult> & {
    translatedText?: string;
  };

  if (!payload.translatedText) {
    throw new Error('HTTP provider response did not include translatedText.');
  }

  return {
    translatedText: payload.translatedText,
    sourceLanguage: payload.sourceLanguage,
    targetLanguage: payload.targetLanguage,
    detectedSourceLanguage: payload.detectedSourceLanguage,
    provider: payload.provider
  };
}
