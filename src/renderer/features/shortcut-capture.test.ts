import { describe, expect, it } from 'vitest';

import { buildShortcutActionFromKeyEvent } from './shortcut-capture';

describe('buildShortcutActionFromKeyEvent', () => {
  it('builds an accelerator from a modifier combination', () => {
    expect(
      buildShortcutActionFromKeyEvent({
        key: 'k',
        ctrlKey: true,
        shiftKey: true
      })
    ).toEqual({
      type: 'set',
      value: 'CommandOrControl+Shift+K'
    });
  });

  it('clears the current shortcut on Backspace or Delete', () => {
    expect(buildShortcutActionFromKeyEvent({ key: 'Backspace' })).toEqual({
      type: 'clear'
    });
    expect(buildShortcutActionFromKeyEvent({ key: 'Delete' })).toEqual({
      type: 'clear'
    });
  });

  it('cancels recording on Escape', () => {
    expect(buildShortcutActionFromKeyEvent({ key: 'Escape' })).toEqual({
      type: 'cancel'
    });
  });

  it('ignores modifier-only keys and plain letters without modifiers', () => {
    expect(buildShortcutActionFromKeyEvent({ key: 'Shift', shiftKey: true })).toEqual({
      type: 'ignore'
    });
    expect(buildShortcutActionFromKeyEvent({ key: 'k' })).toEqual({
      type: 'ignore'
    });
  });

  it('allows standalone function keys', () => {
    expect(buildShortcutActionFromKeyEvent({ key: 'F8' })).toEqual({
      type: 'set',
      value: 'F8'
    });
  });
});
