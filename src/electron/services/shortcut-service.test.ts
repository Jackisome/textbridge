import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import { createShortcutService } from './shortcut-service';

describe('createShortcutService', () => {
  it('registers both global shortcuts and supports re-registering them', () => {
    const operations: string[] = [];

    const shortcutService = createShortcutService({
      registrar: {
        register(accelerator) {
          operations.push(`register:${accelerator}`);
          return true;
        },
        unregisterAll() {
          operations.push('unregisterAll');
        }
      },
      handlers: {
        onQuickTranslate() {},
        onContextTranslate() {}
      }
    });

    shortcutService.applySettings(DEFAULT_SETTINGS);
    shortcutService.applySettings({
      ...DEFAULT_SETTINGS,
      shortcuts: {
        quickTranslate: 'CommandOrControl+Alt+1',
        contextTranslate: 'CommandOrControl+Alt+2'
      }
    });

    expect(operations).toEqual([
      'unregisterAll',
      `register:${DEFAULT_SETTINGS.shortcuts.quickTranslate}`,
      `register:${DEFAULT_SETTINGS.shortcuts.contextTranslate}`,
      'unregisterAll',
      'register:CommandOrControl+Alt+1',
      'register:CommandOrControl+Alt+2'
    ]);
  });
});
