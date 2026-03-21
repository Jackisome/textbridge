// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import { createShortcutService } from './shortcut-service';

describe('createShortcutService', () => {
  it('registers both shortcuts from settings', () => {
    const register = vi.fn().mockReturnValue(true);
    const unregisterAll = vi.fn();
    const onQuickTranslate = vi.fn();
    const onContextTranslate = vi.fn();
    const service = createShortcutService(
      { register, unregisterAll },
      { onQuickTranslate, onContextTranslate }
    );

    service.applySettings(defaultTranslationClientSettings);

    expect(unregisterAll).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenNthCalledWith(
      1,
      defaultTranslationClientSettings.quickTranslateShortcut,
      expect.any(Function)
    );
    expect(register).toHaveBeenNthCalledWith(
      2,
      defaultTranslationClientSettings.contextTranslateShortcut,
      expect.any(Function)
    );
  });

  it('drops old registrations before applying new shortcuts', () => {
    const register = vi.fn().mockReturnValue(true);
    const unregisterAll = vi.fn();
    const service = createShortcutService(
      { register, unregisterAll },
      {
        onQuickTranslate: vi.fn(),
        onContextTranslate: vi.fn()
      }
    );

    service.applySettings(defaultTranslationClientSettings);
    service.applySettings({
      ...defaultTranslationClientSettings,
      quickTranslateShortcut: 'CommandOrControl+Alt+J',
      contextTranslateShortcut: 'F8'
    });

    expect(unregisterAll).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenLastCalledWith('F8', expect.any(Function));
  });

  it('skips empty shortcuts', () => {
    const register = vi.fn().mockReturnValue(true);
    const unregisterAll = vi.fn();
    const service = createShortcutService(
      { register, unregisterAll },
      {
        onQuickTranslate: vi.fn(),
        onContextTranslate: vi.fn()
      }
    );

    service.applySettings({
      ...defaultTranslationClientSettings,
      quickTranslateShortcut: '',
      contextTranslateShortcut: ''
    });

    expect(unregisterAll).toHaveBeenCalledTimes(1);
    expect(register).not.toHaveBeenCalled();
  });

  it('does not throw when shortcut registration fails', () => {
    const register = vi.fn().mockReturnValue(false);
    const unregisterAll = vi.fn();
    const onQuickTranslate = vi.fn();
    const onContextTranslate = vi.fn();
    const service = createShortcutService(
      { register, unregisterAll },
      { onQuickTranslate, onContextTranslate }
    );

    expect(() => {
      service.applySettings(defaultTranslationClientSettings);
    }).not.toThrow();

    expect(unregisterAll).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledTimes(2);
  });
});
