import { describe, expect, it } from 'vitest';
import { decideWriteBackFallback } from './decide-write-back-fallback';

describe('decideWriteBackFallback', () => {
  it('falls back to popup-fallback after replace and paste both fail', () => {
    expect(
      decideWriteBackFallback({
        attempts: [
          {
            success: false,
            method: 'replace-selection',
            errorCode: 'REPLACE_BLOCKED',
            errorMessage: 'The target rejected replacement.'
          },
          {
            success: false,
            method: 'paste-translation',
            errorCode: 'PASTE_BLOCKED',
            errorMessage: 'The target rejected paste.'
          }
        ],
        allowPasteFallback: true,
        allowPopupFallback: true
      })
    ).toEqual({
      action: 'fallback',
      method: 'popup-fallback'
    });
  });
});
