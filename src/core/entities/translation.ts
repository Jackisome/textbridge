import type { OutputMode } from '../../shared/types/settings';

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  instructions?: string;
  outputMode: OutputMode;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  detectedSourceLanguage?: string;
  provider: string;
}
