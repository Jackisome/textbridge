import type { TranslationClientSettings } from '../../shared/types/settings';

export interface GlobalShortcutAdapter {
  register: (accelerator: string, callback: () => void) => boolean;
  unregisterAll: () => void;
}

export interface ShortcutHandlers {
  onQuickTranslate: () => void;
  onContextTranslate: () => void;
}

export interface ShortcutService {
  applySettings: (settings: TranslationClientSettings) => void;
  dispose: () => void;
}

export function createShortcutService(
  adapter: GlobalShortcutAdapter,
  handlers: ShortcutHandlers
): ShortcutService {
  function registerShortcut(accelerator: string, callback: () => void): void {
    if (accelerator.trim().length === 0) {
      return;
    }

    adapter.register(accelerator, callback);
  }

  function applySettings(settings: TranslationClientSettings): void {
    adapter.unregisterAll();
    registerShortcut(settings.quickTranslateShortcut, handlers.onQuickTranslate);
    registerShortcut(settings.contextTranslateShortcut, handlers.onContextTranslate);
  }

  function dispose(): void {
    adapter.unregisterAll();
  }

  return {
    applySettings,
    dispose
  };
}
