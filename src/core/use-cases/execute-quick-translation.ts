import type { TranslationRequest } from '../entities/translation';
import type { TranslationClientSettings } from '../../shared/types/settings';

export interface QuickTranslationInput {
  text: string;
  settings: TranslationClientSettings;
}

export interface UseCaseBusinessError {
  code: 'EMPTY_TEXT';
  message: string;
}

export type QuickTranslationResult =
  | {
      success: true;
      request: TranslationRequest;
    }
  | {
      success: false;
      error: UseCaseBusinessError;
    };

export function executeQuickTranslation({
  text,
  settings
}: QuickTranslationInput): QuickTranslationResult {
  const normalizedText = text.trim();

  if (normalizedText.length === 0) {
    return {
      success: false,
      error: {
        code: 'EMPTY_TEXT',
        message: 'Text to translate is required.'
      }
    };
  }

  return {
    success: true,
    request: {
      text: normalizedText,
      sourceLanguage: settings.sourceLanguage || 'auto',
      targetLanguage: settings.targetLanguage,
      outputMode: settings.outputMode || 'replace-original'
    }
  };
}
