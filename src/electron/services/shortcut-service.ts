import type { AppSettings } from '../../shared/types/settings';

export interface ShortcutRegistrar {
  register(accelerator: string, callback: () => void): boolean;
  unregisterAll(): void;
}

export interface ShortcutHandlers {
  onQuickTranslate(): void | Promise<void>;
  onContextTranslate(): void | Promise<void>;
}

export interface ShortcutService {
  applySettings(settings: AppSettings): void;
  dispose(): void;
  getRegisteredShortcuts(): string[];
}

export interface CreateShortcutServiceOptions {
  registrar: ShortcutRegistrar;
  handlers: ShortcutHandlers;
}

export function createShortcutService({
  registrar,
  handlers
}: CreateShortcutServiceOptions): ShortcutService {
  let registeredShortcuts: string[] = [];

  function registerShortcut(
    accelerator: string,
    callback: () => void | Promise<void>
  ): void {
    if (
      !registrar.register(accelerator, () => {
        void Promise.resolve(callback());
      })
    ) {
      throw new Error(`Failed to register shortcut: ${accelerator}`);
    }

    registeredShortcuts.push(accelerator);
  }

  return {
    applySettings(settings: AppSettings): void {
      registrar.unregisterAll();
      registeredShortcuts = [];

      registerShortcut(settings.shortcuts.quickTranslate, handlers.onQuickTranslate);
      registerShortcut(settings.shortcuts.contextTranslate, handlers.onContextTranslate);
    },
    dispose(): void {
      registrar.unregisterAll();
      registeredShortcuts = [];
    },
    getRegisteredShortcuts(): string[] {
      return [...registeredShortcuts];
    }
  };
}
