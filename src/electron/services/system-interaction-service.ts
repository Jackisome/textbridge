import { clipboard } from 'electron';
import { decideCaptureFallback } from '../../core/use-cases/decide-capture-fallback';
import { decideWriteBackFallback } from '../../core/use-cases/decide-write-back-fallback';
import type { TextCaptureResult } from '../../core/entities/text-capture';
import type { WriteBackResult } from '../../core/entities/write-back';
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
  writeTranslatedText(
    text: string,
    settings?: TranslationClientSettings,
    expectedSourceText?: string
  ): Promise<WriteBackResult>;
  copyToClipboard(text: string): Promise<void>;
}

export interface CreateSystemInteractionServiceOptions {
  adapter?: Pick<Win32Adapter, 'captureText' | 'writeText'> &
    Partial<Pick<Win32Adapter, 'copyToClipboard'>>;
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
