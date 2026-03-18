import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
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
        capture: {
          preferredMethod: 'uia',
          allowClipboardFallback: true
        }
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
        capture: {
          preferredMethod: 'uia',
          allowClipboardFallback: false
        }
      })
    ).resolves.toEqual({
      success: false,
      method: 'uia',
      errorCode: 'TEXT_CAPTURE_NO_SELECTION',
      errorMessage: 'No selection is available.'
    });
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
        writeBack: {
          outputMode: 'replace-original',
          allowPasteFallback: true,
          allowPopupFallback: true
        }
      })
    ).resolves.toEqual({
      success: false,
      method: 'popup-fallback',
      errorCode: 'POPUP_FALLBACK_REQUIRED',
      errorMessage: 'Write-back failed, popup fallback is required.'
    });
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
});
