import type { TranslationRequest } from '../entities/translation';
import type { TranslationClientSettings } from '../../shared/types/settings';
import type { UseCaseBusinessError } from './execute-quick-translation';

export interface ContextTranslationInput {
  text: string;
  instructions?: string;
  settings: TranslationClientSettings;
}

export type ContextTranslationResult =
  | {
      success: true;
      request: TranslationRequest;
    }
  | {
      success: false;
      error: UseCaseBusinessError;
    };

export function executeContextTranslation({
  text,
  instructions,
  settings
}: ContextTranslationInput): ContextTranslationResult {
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

  const normalizedInstructions = instructions?.trim();

  return {
    success: true,
    request: {
      text: normalizedText,
      sourceLanguage: settings.sourceLanguage || 'auto',
      targetLanguage: settings.targetLanguage,
      instructions: normalizedInstructions || undefined,
      outputMode: settings.outputMode || 'replace-original'
    }
  };
}
