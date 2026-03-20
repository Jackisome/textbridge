import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import type { RestoreTarget } from '../../shared/types/context-prompt';
import { createSystemInteractionService } from './system-interaction-service';

describe('createSystemInteractionService', () => {
  it('retries capture through clipboard when the first attempt is unsupported', async () => {
    const adapter = {
      captureText: vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          method: 'uia',
          errorCode: 'TEXT_CAPTURE_UNSUPPORTED',
          errorMessage: 'UI Automation is not available for the focused element.'
        })
        .mockResolvedValueOnce({
          success: true,
          method: 'clipboard',
          text: 'copied text'
        }),
      writeText: vi.fn(),
      copyToClipboard: vi.fn().mockResolvedValue(undefined)
    };
    const service = createSystemInteractionService({
      adapter
    });

    await expect(
      service.captureSelectedText({
        ...DEFAULT_SETTINGS,
        captureMode: 'uia-first',
        enableClipboardFallback: true
      })
    ).resolves.toEqual({
      success: true,
      method: 'clipboard',
      text: 'copied text'
    });
    expect(adapter.captureText).toHaveBeenCalledTimes(2);
    expect(adapter.captureText).toHaveBeenNthCalledWith(1, 'uia');
    expect(adapter.captureText).toHaveBeenNthCalledWith(2, 'clipboard');
  });

  it('returns manual-entry fallback when clipboard retry is disabled', async () => {
    const adapter = {
      captureText: vi.fn().mockResolvedValue({
        success: false,
        method: 'uia',
        errorCode: 'TEXT_CAPTURE_NO_SELECTION',
        errorMessage: 'No selection is available.'
      }),
      writeText: vi.fn(),
      copyToClipboard: vi.fn().mockResolvedValue(undefined)
    };
    const service = createSystemInteractionService({
      adapter
    });

    await expect(
      service.captureSelectedText({
        ...DEFAULT_SETTINGS,
        captureMode: 'uia-first',
        enableClipboardFallback: false
      })
    ).resolves.toEqual({
      success: false,
      method: 'uia',
      errorCode: 'TEXT_CAPTURE_NO_SELECTION',
      errorMessage: 'No selection is available.'
    });
    expect(adapter.captureText).toHaveBeenCalledTimes(1);
    expect(adapter.captureText).toHaveBeenCalledWith('uia');
  });

  it('returns popup-fallback after replace and paste both fail', async () => {
    const adapter = {
      captureText: vi.fn(),
      writeText: vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          method: 'replace-selection',
          errorCode: 'WRITE_BACK_REPLACE_FAILED',
          errorMessage: 'Replace selection failed.'
        })
        .mockResolvedValueOnce({
          success: false,
          method: 'paste-translation',
          errorCode: 'WRITE_BACK_PASTE_FAILED',
          errorMessage: 'Paste translation failed.'
        }),
      copyToClipboard: vi.fn().mockResolvedValue(undefined)
    };
    const service = createSystemInteractionService({
      adapter
    });

    await expect(
      service.writeTranslatedText('你好', {
        ...DEFAULT_SETTINGS,
        outputMode: 'replace-original',
        enablePopupFallback: true
      })
    ).resolves.toEqual({
      success: false,
      method: 'popup-fallback',
      errorCode: 'POPUP_FALLBACK_REQUIRED',
      errorMessage: 'Write-back failed, popup fallback is required.'
    });
    expect(adapter.writeText).toHaveBeenCalledTimes(2);
    expect(adapter.writeText).toHaveBeenNthCalledWith(
      1,
      '你好',
      'replace-selection',
      undefined
    );
    expect(adapter.writeText).toHaveBeenNthCalledWith(
      2,
      '你好',
      'paste-translation',
      undefined
    );
  });

  it('passes the expected source text through both write-back attempts', async () => {
    const adapter = {
      captureText: vi.fn(),
      writeText: vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          method: 'replace-selection',
          errorCode: 'WRITE_BACK_UNSUPPORTED',
          errorMessage: 'Replace selection is not available.'
        })
        .mockResolvedValueOnce({
          success: true,
          method: 'paste-translation'
        }),
      copyToClipboard: vi.fn().mockResolvedValue(undefined)
    };
    const service = createSystemInteractionService({
      adapter
    });

    await expect(
      service.writeTranslatedText('你好', DEFAULT_SETTINGS, 'world')
    ).resolves.toEqual({
      success: true,
      method: 'paste-translation'
    });

    expect(adapter.writeText).toHaveBeenNthCalledWith(
      1,
      '你好',
      'replace-selection',
      'world'
    );
    expect(adapter.writeText).toHaveBeenNthCalledWith(
      2,
      '你好',
      'paste-translation',
      'world'
    );
  });

  it('prefers helper clipboard-write when copying fallback text', async () => {
    const adapter = {
      captureText: vi.fn(),
      writeText: vi.fn(),
      copyToClipboard: vi.fn().mockResolvedValue(undefined)
    };
    const clipboardWriter = {
      writeText: vi.fn()
    };
    const service = createSystemInteractionService({
      adapter,
      clipboardWriter
    });

    await service.copyToClipboard('translated text');

    expect(adapter.copyToClipboard).toHaveBeenCalledWith('translated text');
    expect(clipboardWriter.writeText).not.toHaveBeenCalled();
  });

  it('captures richer selection context through clipboard fallback when the first attempt is unsupported', async () => {
    const adapter = {
      captureText: vi.fn(),
      writeText: vi.fn(),
      copyToClipboard: vi.fn().mockResolvedValue(undefined),
      captureSelectionContext: vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          errorCode: 'TEXT_CAPTURE_UNSUPPORTED',
          errorMessage: 'UI Automation is not available for the focused element.'
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            sourceText: 'copied text',
            captureMethod: 'clipboard',
            anchor: {
              kind: 'selection-rect',
              bounds: { x: 12, y: 24, width: 80, height: 18 },
              displayId: 'display-1'
            },
            restoreTarget: {
              platform: 'win32',
              token: 'hwnd:123'
            },
            capabilities: {
              canPositionPromptNearSelection: true,
              canRestoreTargetAfterPrompt: true,
              canAutoWriteBackAfterPrompt: false
            }
          }
        })
    };
    const service = createSystemInteractionService({
      adapter
    });

    await expect(
      service.captureSelectionContext({
        ...DEFAULT_SETTINGS,
        captureMode: 'uia-first',
        enableClipboardFallback: true
      })
    ).resolves.toEqual({
      success: true,
      data: {
        sourceText: 'copied text',
        captureMethod: 'clipboard',
        anchor: {
          kind: 'selection-rect',
          bounds: { x: 12, y: 24, width: 80, height: 18 },
          displayId: 'display-1'
        },
        restoreTarget: {
          platform: 'win32',
          token: 'hwnd:123'
        },
        capabilities: {
          canPositionPromptNearSelection: true,
          canRestoreTargetAfterPrompt: true,
          canAutoWriteBackAfterPrompt: false
        }
      }
    });

    expect(adapter.captureSelectionContext).toHaveBeenCalledTimes(2);
    expect(adapter.captureSelectionContext).toHaveBeenNthCalledWith(1, 'uia');
    expect(adapter.captureSelectionContext).toHaveBeenNthCalledWith(2, 'clipboard');
  });

  it('derives a portable default selection context when the adapter does not provide richer metadata yet', async () => {
    const adapter = {
      captureText: vi.fn().mockResolvedValue({
        success: true,
        method: 'uia',
        text: 'captured text'
      }),
      writeText: vi.fn(),
      copyToClipboard: vi.fn().mockResolvedValue(undefined)
    };
    const service = createSystemInteractionService({
      adapter
    });

    await expect(service.captureSelectionContext(DEFAULT_SETTINGS)).resolves.toEqual({
      success: true,
      data: {
        sourceText: 'captured text',
        captureMethod: 'uia',
        anchor: {
          kind: 'unknown'
        },
        restoreTarget: null,
        capabilities: {
          canPositionPromptNearSelection: false,
          canRestoreTargetAfterPrompt: false,
          canAutoWriteBackAfterPrompt: false
        }
      }
    });
    expect(adapter.captureText).toHaveBeenCalledTimes(1);
    expect(adapter.captureText).toHaveBeenCalledWith('uia');
  });

  it('restores the original selection target through the richer adapter contract', async () => {
    const adapter = {
      captureText: vi.fn(),
      writeText: vi.fn(),
      copyToClipboard: vi.fn().mockResolvedValue(undefined),
      restoreSelectionTarget: vi.fn().mockResolvedValue({
        success: true,
        restored: true
      })
    };
    const service = createSystemInteractionService({
      adapter
    });
    const restoreTarget: RestoreTarget = {
      platform: 'win32',
      token: 'hwnd:123'
    };

    await expect(service.restoreSelectionTarget(restoreTarget)).resolves.toEqual({
      success: true,
      restored: true
    });
    expect(adapter.restoreSelectionTarget).toHaveBeenCalledTimes(1);
    expect(adapter.restoreSelectionTarget).toHaveBeenCalledWith(restoreTarget);
  });

  it('returns an explicit unsupported result when restore is unavailable in the adapter', async () => {
    const adapter = {
      captureText: vi.fn(),
      writeText: vi.fn(),
      copyToClipboard: vi.fn().mockResolvedValue(undefined)
    };
    const service = createSystemInteractionService({
      adapter
    });

    await expect(
      service.restoreSelectionTarget({
        platform: 'win32',
        token: 'hwnd:123'
      })
    ).resolves.toEqual({
      success: false,
      restored: false,
      errorCode: 'RESTORE_TARGET_UNSUPPORTED',
      errorMessage:
        'The current platform adapter does not support restoring the original selection target.'
    });
  });

  it('rejects restore targets for non-win32 platforms before calling the adapter', async () => {
    const adapter = {
      captureText: vi.fn(),
      writeText: vi.fn(),
      copyToClipboard: vi.fn().mockResolvedValue(undefined),
      restoreSelectionTarget: vi.fn()
    };
    const service = createSystemInteractionService({
      adapter
    });

    await expect(
      service.restoreSelectionTarget({
        platform: 'darwin',
        token: 'ax:123'
      })
    ).resolves.toEqual({
      success: false,
      restored: false,
      errorCode: 'RESTORE_TARGET_PLATFORM_UNSUPPORTED',
      errorMessage:
        'The current system interaction service only supports restoring win32 selection targets.'
    });
    expect(adapter.restoreSelectionTarget).not.toHaveBeenCalled();
  });
});
