import { describe, expect, it } from 'vitest';
import { createFallbackResultPopupState } from './popup-state';

describe('createFallbackResultPopupState', () => {
  it('exposes copy and retry-write-back actions for fallback results', () => {
    const state = createFallbackResultPopupState({
      translatedText: 'Executive summary in business English.',
      errorMessage: 'Write-back failed, popup fallback is required.'
    });

    expect(state.actions).toEqual([
      {
        id: 'copy-result',
        label: 'Copy Result'
      },
      {
        id: 'retry-write-back',
        label: 'Retry Insert'
      }
    ]);
  });
});
