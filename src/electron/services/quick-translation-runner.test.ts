import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import { createQuickTranslationRunner } from './quick-translation-runner';

describe('createQuickTranslationRunner', () => {
  it('captures, translates, writes back, and returns a completed execution report', async () => {
    const popupCalls: unknown[] = [];
    const clipboardCopies: string[] = [];
    const writeCalls: Array<{
      text: string;
      settings: unknown;
      expectedSourceText: string | undefined;
    }> = [];

    const runner = createQuickTranslationRunner({
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
            text: 'Hello world'
          };
        },
        async writeTranslatedText(text, settings, expectedSourceText) {
          writeCalls.push({
            text,
            settings,
            expectedSourceText
          });
          return {
            success: true,
            method: 'replace-selection'
          };
        },
        async copyToClipboard(text) {
          clipboardCopies.push(text);
        }
      },
      translationProviderService: {
        async translateWithSettings() {
          return {
            translatedText: '你好，世界',
            sourceLanguage: 'auto',
            targetLanguage: 'zh-CN',
            detectedSourceLanguage: 'en',
            provider: 'mock'
          };
        }
      },
      popupFallbackPresenter: {
        showResult(payload) {
          popupCalls.push(payload);
        }
      },
      createReportId: () => 'report-1',
      now: () => '2026-03-08T10:00:00.000Z'
    });

    await expect(runner.run()).resolves.toEqual({
      id: 'report-1',
      workflow: 'quick-translation',
      status: 'completed',
      startedAt: '2026-03-08T10:00:00.000Z',
      completedAt: '2026-03-08T10:00:00.000Z',
      provider: 'mock',
      captureMethod: 'uia',
      writeBackMethod: 'replace-selection',
      sourceTextLength: 11,
      translatedTextLength: 5
    });

    expect(clipboardCopies).toEqual([]);
    expect(popupCalls).toEqual([]);
    expect(writeCalls).toEqual([
      {
        text: '你好，世界',
        settings: DEFAULT_SETTINGS,
        expectedSourceText: 'Hello world'
      }
    ]);
  });

  it('shows popup fallback and copies the translation when write-back falls back to popup', async () => {
    const popupCalls: Array<{ translatedText: string }> = [];
    const clipboardCopies: string[] = [];

    const runner = createQuickTranslationRunner({
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
            text: 'Hello world'
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
        async translateWithSettings() {
          return {
            translatedText: '你好，世界',
            sourceLanguage: 'auto',
            targetLanguage: 'zh-CN',
            detectedSourceLanguage: 'en',
            provider: 'mock'
          };
        }
      },
      popupFallbackPresenter: {
        showResult(payload) {
          popupCalls.push({ translatedText: payload.translatedText });
        }
      },
      createReportId: () => 'report-2',
      now: () => '2026-03-08T10:05:00.000Z'
    });

    await expect(runner.run()).resolves.toEqual({
      id: 'report-2',
      workflow: 'quick-translation',
      status: 'fallback-required',
      startedAt: '2026-03-08T10:05:00.000Z',
      completedAt: '2026-03-08T10:05:00.000Z',
      provider: 'mock',
      captureMethod: 'uia',
      writeBackMethod: 'popup-fallback',
      sourceTextLength: 11,
      translatedTextLength: 5,
      errorCode: 'POPUP_FALLBACK_REQUIRED',
      errorMessage: 'Write-back failed, popup fallback is required.'
    });

    expect(clipboardCopies).toEqual(['你好，世界']);
    expect(popupCalls).toEqual([{ translatedText: '你好，世界' }]);
  });

  it('preserves the raw captured selection for write-back verification when translation trims whitespace', async () => {
    const translationRequests: Array<{ text: string }> = [];
    const writeCalls: Array<{
      text: string;
      expectedSourceText: string | undefined;
    }> = [];

    const runner = createQuickTranslationRunner({
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
            text: ' world'
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
            text: request.text
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
      createReportId: () => 'report-3',
      now: () => '2026-03-08T10:10:00.000Z'
    });

    await expect(runner.run()).resolves.toEqual({
      id: 'report-3',
      workflow: 'quick-translation',
      status: 'completed',
      startedAt: '2026-03-08T10:10:00.000Z',
      completedAt: '2026-03-08T10:10:00.000Z',
      provider: 'mock',
      captureMethod: 'uia',
      writeBackMethod: 'paste-translation',
      sourceTextLength: 6,
      translatedTextLength: 12
    });

    expect(translationRequests).toEqual([{ text: 'world' }]);
    expect(writeCalls).toEqual([
      {
        text: '[Mock] world',
        expectedSourceText: ' world'
      }
    ]);
  });
});
