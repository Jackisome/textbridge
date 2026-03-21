import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import type { SelectionContextCapture } from '../../shared/types/context-prompt';
import { createContextTranslationRunner } from './context-translation-runner';

function createSelectionContext(
  overrides: Partial<SelectionContextCapture> = {}
): SelectionContextCapture {
  return {
    sourceText: 'Please summarize this paragraph.',
    captureMethod: 'uia',
    anchor: {
      kind: 'control-rect',
      bounds: {
        x: 24,
        y: 32,
        width: 240,
        height: 48
      }
    },
    restoreTarget: {
      platform: 'win32',
      token: 'hwnd:123'
    },
    capabilities: {
      canPositionPromptNearSelection: true,
      canRestoreTargetAfterPrompt: true,
      canAutoWriteBackAfterPrompt: true
    },
    ...overrides
  };
}

describe('createContextTranslationRunner', () => {
  it('restores the original target before writing translated text and preserves popup fallback when write-back falls back', async () => {
    let translatedRequestInstructions = '';
    const promptCalls: Array<{ sourceText: string; anchor: SelectionContextCapture['anchor'] }> = [];
    const restoreCalls: unknown[] = [];
    const fallbackCalls: Array<{ translatedText: string; sourceText: string }> = [];
    const clipboardCopies: string[] = [];
    const createReportId = vi
      .fn<() => string>()
      .mockReturnValueOnce('context-report-1')
      .mockReturnValueOnce('context-report-2');
    const writeCalls: Array<{
      text: string;
      settings: unknown;
      expectedSourceText: string | undefined;
    }> = [];

    const selectionContext = createSelectionContext();

    const runner = createContextTranslationRunner({
      settingsService: {
        async getSettings() {
          return DEFAULT_SETTINGS;
        }
      },
      systemInteractionService: {
        async captureSelectionContext() {
          return {
            success: true,
            data: selectionContext
          };
        },
        async restoreSelectionTarget(target) {
          restoreCalls.push(target);
          return {
            success: true,
            restored: true
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
      } as any,
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
        async requestContextInstructions(sourceText, anchor) {
          promptCalls.push({
            sourceText,
            anchor
          });
          return 'Use concise business English.';
        },
        async showFallbackResult(payload) {
          fallbackCalls.push({
            translatedText: payload.translatedText,
            sourceText: payload.sourceText
          });
        }
      } as any,
      createReportId,
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

    expect(promptCalls).toEqual([
      {
        sourceText: 'Please summarize this paragraph.',
        anchor: selectionContext.anchor
      }
    ]);
    expect(translatedRequestInstructions).toBe('Use concise business English.');
    expect(restoreCalls).toEqual([selectionContext.restoreTarget]);
    expect(createReportId).toHaveBeenCalledTimes(1);
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

  it('uses the raw selection context text for write-back verification after restoring the target', async () => {
    const promptCalls: Array<{ sourceText: string; anchor: SelectionContextCapture['anchor'] }> = [];
    const translationRequests: Array<{ text: string; instructions?: string }> = [];
    const restoreCalls: unknown[] = [];
    const writeCalls: Array<{
      text: string;
      expectedSourceText: string | undefined;
    }> = [];
    const selectionContext = createSelectionContext({
      sourceText: ' world '
    });

    const runner = createContextTranslationRunner({
      settingsService: {
        async getSettings() {
          return DEFAULT_SETTINGS;
        }
      },
      systemInteractionService: {
        async captureSelectionContext() {
          return {
            success: true,
            data: selectionContext
          };
        },
        async restoreSelectionTarget(target) {
          restoreCalls.push(target);
          return {
            success: true,
            restored: true
          };
        },
        async writeTranslatedText(text, _settings, expectedSourceText) {
          writeCalls.push({
            text,
            expectedSourceText
          });

          return {
            success: true,
            method: 'replace-selection'
          };
        },
        async copyToClipboard() {}
      } as any,
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
        async requestContextInstructions(sourceText, anchor) {
          promptCalls.push({
            sourceText,
            anchor
          });
          return 'Keep punctuation.';
        },
        async showFallbackResult() {}
      } as any,
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
      writeBackMethod: 'replace-selection',
      sourceTextLength: 7,
      translatedTextLength: 12
    });

    expect(promptCalls).toEqual([
      {
        sourceText: ' world ',
        anchor: selectionContext.anchor
      }
    ]);
    expect(translationRequests).toEqual([
      {
        text: 'world',
        instructions: 'Keep punctuation.'
      }
    ]);
    expect(restoreCalls).toEqual([selectionContext.restoreTarget]);
    expect(writeCalls).toEqual([
      {
        text: '[Mock] world',
        expectedSourceText: ' world '
      }
    ]);
  });

  it('returns cancelled and stops before translation or write-back when prompt input is cancelled', async () => {
    const translateWithSettings = vi.fn();
    const restoreSelectionTarget = vi.fn();
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
        async captureSelectionContext() {
          return {
            success: true,
            data: createSelectionContext()
          };
        },
        restoreSelectionTarget,
        writeTranslatedText,
        copyToClipboard
      } as any,
      translationProviderService: {
        translateWithSettings
      },
      popupService: {
        async requestContextInstructions() {
          return null;
        },
        showFallbackResult
      } as any,
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
    expect(restoreSelectionTarget).not.toHaveBeenCalled();
    expect(writeTranslatedText).not.toHaveBeenCalled();
    expect(copyToClipboard).not.toHaveBeenCalled();
    expect(showFallbackResult).not.toHaveBeenCalled();
  });

  it('falls back before write-back when restore fails after translation', async () => {
    const restoreSelectionTarget = vi.fn().mockResolvedValue({
      success: false,
      restored: false,
      errorCode: 'RESTORE_TARGET_FAILED',
      errorMessage: 'Failed to restore the original selection target.'
    });
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
        async captureSelectionContext() {
          return {
            success: true,
            data: createSelectionContext()
          };
        },
        restoreSelectionTarget,
        writeTranslatedText,
        async copyToClipboard(text) {
          copyToClipboard(text);
        }
      } as any,
      translationProviderService: {
        async translateWithSettings() {
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
          showFallbackResult(payload);
        }
      } as any,
      createReportId: () => 'context-report-restore-failed',
      now: () => '2026-03-20T10:10:00.000Z'
    });

    await expect(runner.run()).resolves.toEqual({
      id: 'context-report-restore-failed',
      workflow: 'context-translation',
      status: 'fallback-required',
      startedAt: '2026-03-20T10:10:00.000Z',
      completedAt: '2026-03-20T10:10:00.000Z',
      provider: 'mock',
      captureMethod: 'uia',
      writeBackMethod: 'popup-fallback',
      sourceTextLength: 32,
      translatedTextLength: 38,
      errorCode: 'RESTORE_TARGET_FAILED',
      errorMessage: 'Failed to restore the original selection target.'
    });

    expect(restoreSelectionTarget).toHaveBeenCalledTimes(1);
    expect(writeTranslatedText).not.toHaveBeenCalled();
    expect(copyToClipboard).toHaveBeenCalledWith('Executive summary in business English.');
    expect(showFallbackResult).toHaveBeenCalledTimes(1);
  });

  it('falls back without attempting write-back when auto write-back after prompt is unsupported', async () => {
    const restoreSelectionTarget = vi.fn().mockResolvedValue({
      success: true,
      restored: true
    });
    const writeTranslatedText = vi.fn();
    const copyToClipboard = vi.fn();
    const showFallbackResult = vi.fn();
    const selectionContext = createSelectionContext({
      capabilities: {
        canPositionPromptNearSelection: true,
        canRestoreTargetAfterPrompt: true,
        canAutoWriteBackAfterPrompt: false
      }
    });

    const runner = createContextTranslationRunner({
      settingsService: {
        async getSettings() {
          return DEFAULT_SETTINGS;
        }
      },
      systemInteractionService: {
        async captureSelectionContext() {
          return {
            success: true,
            data: selectionContext
          };
        },
        restoreSelectionTarget,
        writeTranslatedText,
        async copyToClipboard(text) {
          copyToClipboard(text);
        }
      } as any,
      translationProviderService: {
        async translateWithSettings() {
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
          showFallbackResult(payload);
        }
      } as any,
      createReportId: () => 'context-report-unsupported-writeback',
      now: () => '2026-03-20T10:20:00.000Z'
    });

    await expect(runner.run()).resolves.toEqual({
      id: 'context-report-unsupported-writeback',
      workflow: 'context-translation',
      status: 'fallback-required',
      startedAt: '2026-03-20T10:20:00.000Z',
      completedAt: '2026-03-20T10:20:00.000Z',
      provider: 'mock',
      captureMethod: 'uia',
      writeBackMethod: 'popup-fallback',
      sourceTextLength: 32,
      translatedTextLength: 38,
      errorCode: 'WRITE_BACK_UNSUPPORTED',
      errorMessage: 'Automatic write-back after prompt is not supported for the captured target.'
    });

    expect(restoreSelectionTarget).toHaveBeenCalledWith(selectionContext.restoreTarget);
    expect(writeTranslatedText).not.toHaveBeenCalled();
    expect(copyToClipboard).toHaveBeenCalledWith('Executive summary in business English.');
    expect(showFallbackResult).toHaveBeenCalledTimes(1);
  });
});
