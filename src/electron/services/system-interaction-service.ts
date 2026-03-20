import { clipboard } from 'electron';
import { decideCaptureFallback } from '../../core/use-cases/decide-capture-fallback';
import { decideWriteBackFallback } from '../../core/use-cases/decide-write-back-fallback';
import type { TextCaptureResult } from '../../core/entities/text-capture';
import type { WriteBackResult } from '../../core/entities/write-back';
import type {
  RestoreTarget,
  SelectionContextCapture
} from '../../shared/types/context-prompt';
import type { TranslationClientSettings } from '../../shared/types/settings';
import {
  createWin32Adapter,
  type Win32Adapter
} from '../platform/win32/adapter';
import type {
  Win32CaptureMethod,
  Win32WriteMethod
} from '../platform/win32/protocol';

export interface SystemInteractionService {
  captureSelectedText(settings?: TranslationClientSettings): Promise<TextCaptureResult>;
  captureSelectionContext(settings?: TranslationClientSettings): Promise<{
    success: boolean;
    data?: SelectionContextCapture;
    errorCode?: string;
    errorMessage?: string;
  }>;
  restoreSelectionTarget(target: RestoreTarget): Promise<{
    success: boolean;
    restored: boolean;
    errorCode?: string;
    errorMessage?: string;
  }>;
  writeTranslatedText(
    text: string,
    settings?: TranslationClientSettings,
    expectedSourceText?: string
  ): Promise<WriteBackResult>;
  copyToClipboard(text: string): Promise<void>;
}

export interface CreateSystemInteractionServiceOptions {
  adapter?: Pick<Win32Adapter, 'captureText' | 'writeText'> &
    Partial<
      Pick<
        Win32Adapter,
        'copyToClipboard' | 'captureSelectionContext' | 'restoreSelectionTarget'
      >
    >;
  clipboardWriter?: {
    writeText(text: string): void;
  };
}

export function createSystemInteractionService({
  adapter = createWin32Adapter(),
  clipboardWriter = clipboard
}: CreateSystemInteractionServiceOptions = {}): SystemInteractionService {
  return {
    async captureSelectedText(
      settings?: TranslationClientSettings
    ): Promise<TextCaptureResult> {
      const attempts: TextCaptureResult[] = [];
      const preferredMethod: Win32CaptureMethod =
        settings?.captureMode === 'clipboard-first' ? 'clipboard' : 'uia';

      attempts.push(await adapter.captureText(preferredMethod));

      const decision = decideCaptureFallback({
        attempts,
        allowClipboardFallback: settings?.enableClipboardFallback ?? true
      });

      if (decision.action === 'retry') {
        attempts.push(await adapter.captureText(decision.method));
      }

      if (attempts.at(-1)) {
        return attempts.at(-1)!;
      }

      return {
        success: false,
        method: 'manual-entry',
        errorCode: 'CAPTURE_NOT_ATTEMPTED',
        errorMessage: 'No capture attempt was executed.'
      };
    },
    async captureSelectionContext(settings?: TranslationClientSettings): Promise<{
      success: boolean;
      data?: SelectionContextCapture;
      errorCode?: string;
      errorMessage?: string;
    }> {
      if (typeof adapter.captureSelectionContext === 'function') {
        const attempts: Array<{
          success: boolean;
          data?: SelectionContextCapture;
          errorCode?: string;
          errorMessage?: string;
        }> = [];
        const preferredMethod: Win32CaptureMethod =
          settings?.captureMode === 'clipboard-first' ? 'clipboard' : 'uia';

        attempts.push(await adapter.captureSelectionContext(preferredMethod));

        const decision = decideCaptureFallback({
          attempts: attempts.map((attempt) =>
            attempt.success && attempt.data
              ? {
                  success: true,
                  method: attempt.data.captureMethod,
                  text: attempt.data.sourceText
                }
              : {
                  success: false,
                  method: preferredMethod,
                  errorCode: attempt.errorCode,
                  errorMessage: attempt.errorMessage
                }
          ),
          allowClipboardFallback: settings?.enableClipboardFallback ?? true
        });

        if (decision.action === 'retry') {
          attempts.push(await adapter.captureSelectionContext(decision.method));
        }

        const lastAttempt = attempts.at(-1);

        if (lastAttempt) {
          return lastAttempt;
        }

        return {
          success: false,
          errorCode: 'CAPTURE_NOT_ATTEMPTED',
          errorMessage: 'No selection context capture attempt was executed.'
        };
      }

      const captureResult = await this.captureSelectedText(settings);

      if (!captureResult.success) {
        return {
          success: false,
          errorCode: captureResult.errorCode,
          errorMessage: captureResult.errorMessage
        };
      }

      return {
        success: true,
        data: {
          sourceText: captureResult.text ?? '',
          captureMethod: captureResult.method,
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
      };
    },
    async restoreSelectionTarget(target: RestoreTarget): Promise<{
      success: boolean;
      restored: boolean;
      errorCode?: string;
      errorMessage?: string;
    }> {
      if (typeof adapter.restoreSelectionTarget === 'function') {
        return adapter.restoreSelectionTarget(target);
      }

      return {
        success: false,
        restored: false,
        errorCode: 'RESTORE_TARGET_UNSUPPORTED',
        errorMessage:
          'The current platform adapter does not support restoring the original selection target.'
      };
    },
    async writeTranslatedText(
      text: string,
      settings?: TranslationClientSettings,
      expectedSourceText?: string
    ): Promise<WriteBackResult> {
      if (settings?.outputMode === 'show-popup') {
        return {
          success: false,
          method: 'popup-fallback',
          errorCode: 'POPUP_FALLBACK_REQUIRED',
          errorMessage: 'Current settings prefer showing the translated result in a popup.'
        };
      }

      const attempts: WriteBackResult[] = [];
      const initialMethod: Win32WriteMethod = 'replace-selection';

      attempts.push(await adapter.writeText(text, initialMethod, expectedSourceText));

      const decision = decideWriteBackFallback({
        attempts,
        allowPasteFallback: true,
        allowPopupFallback: settings?.enablePopupFallback ?? true
      });

      if (decision.action === 'retry') {
        attempts.push(
          await adapter.writeText(text, decision.method, expectedSourceText)
        );

        const followUpDecision = decideWriteBackFallback({
          attempts,
          allowPasteFallback: true,
          allowPopupFallback: settings?.enablePopupFallback ?? true
        });

        if (followUpDecision.action === 'fallback') {
          return {
            success: false,
            method: 'popup-fallback',
            errorCode: 'POPUP_FALLBACK_REQUIRED',
            errorMessage: 'Write-back failed, popup fallback is required.'
          };
        }
      }

      if (decision.action === 'fallback') {
        return {
          success: false,
          method: 'popup-fallback',
          errorCode: 'POPUP_FALLBACK_REQUIRED',
          errorMessage: 'Write-back failed, popup fallback is required.'
        };
      }

      if (attempts.at(-1)) {
        return attempts.at(-1)!;
      }

      return {
        success: false,
        method: 'popup-fallback',
        errorCode: 'WRITE_BACK_NOT_ATTEMPTED',
        errorMessage: 'No write-back attempt was executed.'
      };
    },
    async copyToClipboard(text: string): Promise<void> {
      if (typeof adapter.copyToClipboard === 'function') {
        try {
          await adapter.copyToClipboard(text);
          return;
        } catch {
          // Fall back to Electron clipboard when the helper bridge is unavailable.
        }
      }

      clipboardWriter.writeText(text);
    }
  };
}
