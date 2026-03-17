import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import { executeQuickTranslation } from './execute-quick-translation';

describe('executeQuickTranslation', () => {
  it('builds a translation request from the active settings', () => {
    const result = executeQuickTranslation({
      text: 'Hello world',
      settings: DEFAULT_SETTINGS
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error('Expected a successful translation request.');
    }

    expect(result.request).toEqual({
      text: 'Hello world',
      sourceLanguage: DEFAULT_SETTINGS.sourceLanguage,
      targetLanguage: DEFAULT_SETTINGS.targetLanguage,
      outputMode: DEFAULT_SETTINGS.outputMode
    });
    expect(result.request.outputMode).toBe('replace-original');
  });

  it('returns a structured business error when the input text is empty', () => {
    const result = executeQuickTranslation({
      text: '   ',
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
