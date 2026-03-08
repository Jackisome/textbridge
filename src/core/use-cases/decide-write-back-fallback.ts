import type { WriteBackResult } from '../entities/write-back';

export type WriteBackFallbackDecision =
  | {
      action: 'use-result';
    }
  | {
      action: 'retry';
      method: 'paste-translation';
    }
  | {
      action: 'fallback';
      method: 'popup-fallback';
    };

export interface DecideWriteBackFallbackInput {
  attempts: WriteBackResult[];
  allowPasteFallback: boolean;
  allowPopupFallback: boolean;
}

export function decideWriteBackFallback({
  attempts,
  allowPasteFallback,
  allowPopupFallback
}: DecideWriteBackFallbackInput): WriteBackFallbackDecision {
  const latestAttempt = attempts.at(-1);

  if (!latestAttempt || latestAttempt.success) {
    return { action: 'use-result' };
  }

  const alreadyTriedPaste = attempts.some(
    (attempt) => attempt.method === 'paste-translation'
  );

  if (
    latestAttempt.method === 'replace-selection' &&
    allowPasteFallback &&
    !alreadyTriedPaste
  ) {
    return {
      action: 'retry',
      method: 'paste-translation'
    };
  }

  if (allowPopupFallback) {
    return {
      action: 'fallback',
      method: 'popup-fallback'
    };
  }

  return {
    action: 'use-result'
  };
}
