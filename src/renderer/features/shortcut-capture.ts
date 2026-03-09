export interface ShortcutKeyboardEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export type ShortcutCaptureAction =
  | {
      type: 'set';
      value: string;
    }
  | {
      type: 'clear';
    }
  | {
      type: 'cancel';
    };

const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  Spacebar: 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right'
};

export function buildShortcutActionFromKeyEvent(
  event: ShortcutKeyboardEvent
): ShortcutCaptureAction {
  if (event.key === 'Escape') {
    return { type: 'cancel' };
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    return { type: 'clear' };
  }

  const normalizedKey = normalizeAcceleratorKey(event);
  const modifiers: string[] = [];

  if (event.ctrlKey || event.metaKey) {
    modifiers.push('CommandOrControl');
  }

  if (event.altKey) {
    modifiers.push('Alt');
  }

  if (event.shiftKey) {
    modifiers.push('Shift');
  }

  return {
    type: 'set',
    value: [...modifiers, normalizedKey].join('+')
  };
}

function normalizeAcceleratorKey(event: ShortcutKeyboardEvent): string {
  const aliasedKey = KEY_ALIASES[event.key] ?? event.key;

  if (aliasedKey.length === 1) {
    return aliasedKey.toUpperCase();
  }

  if (event.code.startsWith('Key') && event.code.length === 4) {
    return event.code.slice(3).toUpperCase();
  }

  if (event.code.startsWith('Digit') && event.code.length === 6) {
    return event.code.slice(5);
  }

  return aliasedKey;
}
