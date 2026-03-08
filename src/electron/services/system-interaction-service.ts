import { decideCaptureFallback } from '../../core/use-cases/decide-capture-fallback';
import { decideWriteBackFallback } from '../../core/use-cases/decide-write-back-fallback';
import type { TextCaptureResult } from '../../core/entities/text-capture';
import type { WriteBackResult } from '../../core/entities/write-back';
import type { AppSettings } from '../../shared/types/settings';
import {
  createWin32Adapter,
  type Win32Adapter
} from '../platform/win32/adapter';
import type {
  Win32CaptureMethod,
  Win32WriteMethod
} from '../platform/win32/protocol';

export interface SystemInteractionService {
  captureSelectedText(settings?: AppSettings): Promise<TextCaptureResult>;
  writeTranslatedText(
    text: string,
    settings?: AppSettings
  ): Promise<WriteBackResult>;
}

export interface CreateSystemInteractionServiceOptions {
  adapter?: Win32Adapter;
}

export function createSystemInteractionService({
  adapter = createWin32Adapter()
}: CreateSystemInteractionServiceOptions = {}): SystemInteractionService {
  return {
    async captureSelectedText(settings?: AppSettings): Promise<TextCaptureResult> {
      const attempts: TextCaptureResult[] = [];
      const preferredMethod: Win32CaptureMethod =
        settings?.capture.preferredMethod ?? 'uia';

      attempts.push(await adapter.captureText(preferredMethod));

      const decision = decideCaptureFallback({
        attempts,
        allowClipboardFallback: settings?.capture.allowClipboardFallback ?? true
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
      settings?: AppSettings
    ): Promise<WriteBackResult> {
      const attempts: WriteBackResult[] = [];
      const initialMethod: Win32WriteMethod =
        settings?.writeBack.outputMode === 'append-translation'
          ? 'paste-translation'
          : 'replace-selection';

      attempts.push(await adapter.writeText(text, initialMethod));

      const decision = decideWriteBackFallback({
        attempts,
        allowPasteFallback: settings?.writeBack.allowPasteFallback ?? true,
        allowPopupFallback: settings?.writeBack.allowPopupFallback ?? true
      });

      if (decision.action === 'retry') {
        attempts.push(await adapter.writeText(text, decision.method));

        const followUpDecision = decideWriteBackFallback({
          attempts,
          allowPasteFallback: settings?.writeBack.allowPasteFallback ?? true,
          allowPopupFallback: settings?.writeBack.allowPopupFallback ?? true
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
    }
  };
}
