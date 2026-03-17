import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import { executeContextTranslation } from './execute-context-translation';

describe('executeContextTranslation', () => {
  it('carries user instructions into the translation request', () => {
    const result = executeContextTranslation({
      text: 'Please summarize this paragraph.',
      instructions: 'Use concise business English.',
      settings: DEFAULT_SETTINGS
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error('Expected a successful context translation request.');
    }

    expect(result.request).toEqual({
      text: 'Please summarize this paragraph.',
      sourceLanguage: DEFAULT_SETTINGS.sourceLanguage,
      targetLanguage: DEFAULT_SETTINGS.targetLanguage,
      instructions: 'Use concise business English.',
      outputMode: DEFAULT_SETTINGS.outputMode
    });
  });

  it('returns a structured business error when the input text is empty', () => {
    const result = executeContextTranslation({
      text: '',
      instructions: 'Use concise business English.',
      settings: DEFAULT_SETTINGS
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: 'EMPTY_TEXT',
        message: 'Text to translate is required.'
      }
    });
  });
});
