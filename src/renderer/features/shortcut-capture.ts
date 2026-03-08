export interface ShortcutKeyboardEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
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
    }
  | {
      type: 'ignore';
    };

const modifierKeys = new Set([
  'Alt',
  'AltGraph',
  'CapsLock',
  'Control',
  'Fn',
  'Meta',
  'NumLock',
  'ScrollLock',
  'Shift'
]);

const namedPrimaryKeys: Record<string, string> = {
  ' ': 'Space',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  End: 'End',
  Enter: 'Enter',
  Home: 'Home',
  Insert: 'Insert',
  PageDown: 'PageDown',
  PageUp: 'PageUp',
  Spacebar: 'Space',
  Tab: 'Tab'
};

function normalizePrimaryKey(key: string): string | null {
  if (modifierKeys.has(key)) {
    return null;
  }

  if (/^[a-z0-9]$/i.test(key)) {
    return key.toUpperCase();
  }

  if (/^F\d{1,2}$/i.test(key)) {
    return key.toUpperCase();
  }

  return namedPrimaryKeys[key] ?? null;
}

export function buildShortcutActionFromKeyEvent(
  event: ShortcutKeyboardEventLike
): ShortcutCaptureAction {
  if (event.repeat) {
    return { type: 'ignore' };
  }

  if (event.key === 'Escape') {
    return { type: 'cancel' };
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    return { type: 'clear' };
  }

  const primaryKey = normalizePrimaryKey(event.key);

  if (primaryKey === null) {
    return { type: 'ignore' };
  }

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

  const isFunctionKey = /^F\d{1,2}$/.test(primaryKey);

  if (modifiers.length === 0 && !isFunctionKey) {
    return { type: 'ignore' };
  }

  return {
    type: 'set',
    value: [...modifiers, primaryKey].join('+')
  };
}
