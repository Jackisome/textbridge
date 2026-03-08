import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import { createContextTranslationRunner } from './context-translation-runner';

describe('createContextTranslationRunner', () => {
  it('collects user instructions and preserves the result when write-back falls back to popup', async () => {
    let translatedRequestInstructions = '';
    const fallbackCalls: Array<{ translatedText: string; sourceText: string }> = [];
    const clipboardCopies: string[] = [];

    const runner = createContextTranslationRunner({
      settingsService: {
        async getSettings() {
          return DEFAULT_SETTINGS;
        }
      },
      systemInteractionService: {
        async captureSelectedText() {
          return {
            success: true,
            method: 'uia',
            text: 'Please summarize this paragraph.'
          };
        },
        async writeTranslatedText() {
          return {
            success: false,
            method: 'popup-fallback',
            errorCode: 'POPUP_FALLBACK_REQUIRED',
            errorMessage: 'Write-back failed, popup fallback is required.'
          };
        },
        async copyToClipboard(text) {
          clipboardCopies.push(text);
        }
      },
      translationProviderService: {
        async translateWithSettings(_settings, request) {
          translatedRequestInstructions = request.instructions ?? '';

          return {
            translatedText: 'Executive summary in business English.',
            sourceLanguage: 'auto',
            targetLanguage: 'zh-CN',
            detectedSourceLanguage: 'en',
            provider: 'mock'
          };
        }
      },
      popupService: {
        async requestContextInstructions() {
          return 'Use concise business English.';
        },
        async showFallbackResult(payload) {
          fallbackCalls.push({
            translatedText: payload.translatedText,
            sourceText: payload.sourceText
          });
        }
      },
      createReportId: () => 'context-report-1',
      now: () => '2026-03-08T11:00:00.000Z'
    });

    await expect(runner.run()).resolves.toEqual({
      id: 'context-report-1',
      workflow: 'context-translation',
      status: 'fallback-required',
      startedAt: '2026-03-08T11:00:00.000Z',
      completedAt: '2026-03-08T11:00:00.000Z',
      provider: 'mock',
      captureMethod: 'uia',
      writeBackMethod: 'popup-fallback',
      sourceTextLength: 32,
      translatedTextLength: 38,
      errorCode: 'POPUP_FALLBACK_REQUIRED',
      errorMessage: 'Write-back failed, popup fallback is required.'
    });

    expect(translatedRequestInstructions).toBe('Use concise business English.');
    expect(clipboardCopies).toEqual(['Executive summary in business English.']);
    expect(fallbackCalls).toEqual([
      {
        translatedText: 'Executive summary in business English.',
        sourceText: 'Please summarize this paragraph.'
      }
    ]);
  });
});
