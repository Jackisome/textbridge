import { describe, expect, it } from 'vitest';
import {
  buildShortcutActionFromKeyEvent,
  type ShortcutKeyboardEvent
} from './shortcut-capture';

function createKeyboardEvent(
  overrides: Partial<ShortcutKeyboardEvent>
): ShortcutKeyboardEvent {
  return {
    key: 'k',
    code: 'KeyK',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...overrides
  };
}

describe('buildShortcutActionFromKeyEvent', () => {
  it('builds an Electron accelerator from modifier keys and a printable key', () => {
    expect(
      buildShortcutActionFromKeyEvent(
        createKeyboardEvent({
          key: 'k',
          code: 'KeyK',
          ctrlKey: true,
          shiftKey: true
        })
      )
    ).toEqual({
      type: 'set',
      value: 'CommandOrControl+Shift+K'
    });
  });

  it('clears the shortcut when backspace or delete is pressed', () => {
    expect(
      buildShortcutActionFromKeyEvent(
        createKeyboardEvent({
          key: 'Backspace',
          code: 'Backspace'
        })
      )
    ).toEqual({
      type: 'clear'
    });
  });

  it('cancels capture when escape is pressed', () => {
    expect(
      buildShortcutActionFromKeyEvent(
        createKeyboardEvent({
          key: 'Escape',
          code: 'Escape'
        })
      )
    ).toEqual({
      type: 'cancel'
    });
  });
});
