import type { TranslationClientSettings } from '../../shared/types/settings';

export interface GlobalShortcutAdapter {
  register: (accelerator: string, callback: () => void) => boolean;
  unregisterAll: () => void;
}

export interface ShortcutHandlers {
  onQuickTranslate: () => void | Promise<void>;
  onContextTranslate: () => void | Promise<void>;
}

export interface ShortcutService {
  applySettings: (settings: TranslationClientSettings) => void;
  getRegisteredShortcuts: () => string[];
  dispose: () => void;
}

export interface CreateShortcutServiceOptions {
  registrar: GlobalShortcutAdapter;
  handlers: ShortcutHandlers;
}

export function createShortcutService(
  adapter: GlobalShortcutAdapter,
  handlers: ShortcutHandlers
): ShortcutService;
export function createShortcutService(
  options: CreateShortcutServiceOptions
): ShortcutService;
export function createShortcutService(
  adapterOrOptions: GlobalShortcutAdapter | CreateShortcutServiceOptions,
  maybeHandlers?: ShortcutHandlers
): ShortcutService {
  const adapter =
    'registrar' in adapterOrOptions ? adapterOrOptions.registrar : adapterOrOptions;
  const handlers =
    'registrar' in adapterOrOptions ? adapterOrOptions.handlers : maybeHandlers;

  if (handlers === undefined) {
    throw new Error('Shortcut handlers are required.');
  }

  const resolvedHandlers = handlers;
  let registeredShortcuts: string[] = [];

  function registerShortcut(
    accelerator: string,
    callback: () => void | Promise<void>
  ): void {
    if (accelerator.trim().length === 0) {
      return;
    }

    if (
      !adapter.register(accelerator, () => {
        void Promise.resolve(callback());
      })
    ) {
      console.warn(`[ShortcutService] Failed to register shortcut: ${accelerator}. It may already be in use by another application.`);
      return;
    }

    registeredShortcuts.push(accelerator);
  }

  function applySettings(settings: TranslationClientSettings): void {
    adapter.unregisterAll();
    registeredShortcuts = [];
    registerShortcut(settings.quickTranslateShortcut, resolvedHandlers.onQuickTranslate);
    registerShortcut(settings.contextTranslateShortcut, resolvedHandlers.onContextTranslate);
  }

  function dispose(): void {
    adapter.unregisterAll();
    registeredShortcuts = [];
  }

  return {
    applySettings,
    getRegisteredShortcuts() {
      return [...registeredShortcuts];
    },
    dispose
  };
}
