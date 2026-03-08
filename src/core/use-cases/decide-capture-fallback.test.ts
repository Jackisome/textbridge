import { describe, expect, it } from 'vitest';
import { decideCaptureFallback } from './decide-capture-fallback';

describe('decideCaptureFallback', () => {
  it('moves from UIA to clipboard fallback after a failed UIA capture', () => {
    expect(
      decideCaptureFallback({
        attempts: [
          {
            success: false,
            method: 'uia',
            errorCode: 'UIA_UNAVAILABLE',
            errorMessage: 'The focused control is not UIA-accessible.'
          }
        ],
        allowClipboardFallback: true
      })
    ).toEqual({
      action: 'retry',
      method: 'clipboard'
    });
  });
});
