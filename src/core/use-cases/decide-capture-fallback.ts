import type { TextCaptureResult } from '../entities/text-capture';

export type CaptureFallbackDecision =
  | {
      action: 'use-result';
    }
  | {
      action: 'retry';
      method: 'clipboard';
    }
  | {
      action: 'fallback';
      method: 'manual-entry';
    };

export interface DecideCaptureFallbackInput {
  attempts: TextCaptureResult[];
  allowClipboardFallback: boolean;
}

export function decideCaptureFallback({
  attempts,
  allowClipboardFallback
}: DecideCaptureFallbackInput): CaptureFallbackDecision {
  const latestAttempt = attempts.at(-1);

  if (!latestAttempt || latestAttempt.success) {
    return { action: 'use-result' };
  }

  const alreadyTriedClipboard = attempts.some(
    (attempt) => attempt.method === 'clipboard'
  );

  if (
    latestAttempt.method === 'uia' &&
    allowClipboardFallback &&
    !alreadyTriedClipboard
  ) {
    return {
      action: 'retry',
      method: 'clipboard'
    };
  }

  return {
    action: 'fallback',
    method: 'manual-entry'
  };
}
