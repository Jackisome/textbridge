import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import { createContextTranslationRunner } from './context-translation-runner';

describe('createContextTranslationRunner', () => {
  it('collects user instructions and preserves the result when write-back falls back to popup', async () => {
    let translatedRequestInstructions = '';
    const fallbackCalls: Array<{ translatedText: string; sourceText: string }> = [];
    const clipboardCopies: string[] = [];
    const writeCalls: Array<{
      text: string;
      settings: unknown;
      expectedSourceText: string | undefined;
    }> = [];

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
        async writeTranslatedText(text, settings, expectedSourceText) {
          writeCalls.push({
            text,
            settings,
            expectedSourceText
          });
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
    expect(writeCalls).toEqual([
      {
        text: 'Executive summary in business English.',
        settings: DEFAULT_SETTINGS,
        expectedSourceText: 'Please summarize this paragraph.'
      }
    ]);
  });

  it('uses the raw captured text for write-back verification when context translation trims whitespace', async () => {
    const translationRequests: Array<{ text: string; instructions?: string }> = [];
    const writeCalls: Array<{
      text: string;
      expectedSourceText: string | undefined;
    }> = [];

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
            text: ' world '
          };
        },
        async writeTranslatedText(text, _settings, expectedSourceText) {
          writeCalls.push({
            text,
            expectedSourceText
          });

          return {
            success: true,
            method: 'paste-translation'
          };
        },
        async copyToClipboard() {}
      },
      translationProviderService: {
        async translateWithSettings(_settings, request) {
          translationRequests.push({
            text: request.text,
            instructions: request.instructions
          });

          return {
            translatedText: '[Mock] world',
            sourceLanguage: 'auto',
            targetLanguage: 'zh-CN',
            detectedSourceLanguage: 'en',
            provider: 'mock'
          };
        }
      },
      popupService: {
        async requestContextInstructions() {
          return 'Keep punctuation.';
        },
        async showFallbackResult() {}
      },
      createReportId: () => 'context-report-2',
      now: () => '2026-03-08T11:10:00.000Z'
    });

    await expect(runner.run()).resolves.toEqual({
      id: 'context-report-2',
      workflow: 'context-translation',
      status: 'completed',
      startedAt: '2026-03-08T11:10:00.000Z',
      completedAt: '2026-03-08T11:10:00.000Z',
      provider: 'mock',
      captureMethod: 'uia',
      writeBackMethod: 'paste-translation',
      sourceTextLength: 7,
      translatedTextLength: 12
    });

    expect(translationRequests).toEqual([
      {
        text: 'world',
        instructions: 'Keep punctuation.'
      }
    ]);
    expect(writeCalls).toEqual([
      {
        text: '[Mock] world',
        expectedSourceText: ' world '
      }
    ]);
  });

  it('returns cancelled and stops before translation or write-back when prompt input is cancelled', async () => {
    const translateWithSettings = vi.fn();
    const writeTranslatedText = vi.fn();
    const copyToClipboard = vi.fn();
    const showFallbackResult = vi.fn();

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
        writeTranslatedText,
        copyToClipboard
      },
      translationProviderService: {
        translateWithSettings
      },
      popupService: {
        async requestContextInstructions() {
          return null;
        },
        showFallbackResult
      },
      createReportId: () => 'context-report-cancelled',
      now: () => '2026-03-20T10:00:00.000Z'
    });

    await expect(runner.run()).resolves.toEqual({
      id: 'context-report-cancelled',
      workflow: 'context-translation',
      status: 'cancelled',
      startedAt: '2026-03-20T10:00:00.000Z',
      completedAt: '2026-03-20T10:00:00.000Z',
      captureMethod: 'uia',
      sourceTextLength: 32,
      translatedTextLength: 0,
      errorCode: 'CONTEXT_INPUT_CANCELLED',
      errorMessage: 'Context instructions were cancelled.'
    });

    expect(translateWithSettings).not.toHaveBeenCalled();
    expect(writeTranslatedText).not.toHaveBeenCalled();
    expect(copyToClipboard).not.toHaveBeenCalled();
    expect(showFallbackResult).not.toHaveBeenCalled();
  });
});
