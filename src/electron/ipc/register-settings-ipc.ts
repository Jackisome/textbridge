import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { RuntimeStatus } from '../../shared/types/ipc';
import type { TranslationClientSettings } from '../../shared/types/settings';
import type { SettingsService } from '../services/settings-service';

interface RuntimeStatusProvider {
  getRuntimeStatus(): Promise<RuntimeStatus>;
}

interface RegisterSettingsIpcOptions {
  onAfterSave?: (settings: TranslationClientSettings) => void | Promise<void>;
  runtimeStatusProvider?: RuntimeStatusProvider;
}

interface RegisterSettingsIpcDependencies extends RegisterSettingsIpcOptions {
  settingsService: SettingsService;
}

export function registerSettingsIpc(
  settingsService: SettingsService,
  options?: RegisterSettingsIpcOptions
): void;
export function registerSettingsIpc(
  dependencies: RegisterSettingsIpcDependencies
): void;
export function registerSettingsIpc(
  settingsServiceOrDependencies: SettingsService | RegisterSettingsIpcDependencies,
  options: RegisterSettingsIpcOptions = {}
): void {
  const settingsService =
    'settingsService' in settingsServiceOrDependencies
      ? settingsServiceOrDependencies.settingsService
      : settingsServiceOrDependencies;
  const resolvedOptions =
    'settingsService' in settingsServiceOrDependencies
      ? {
          onAfterSave:
            settingsServiceOrDependencies.onAfterSave ??
            settingsServiceOrDependencies.onAfterSave,
          runtimeStatusProvider: settingsServiceOrDependencies.runtimeStatusProvider
        }
      : options;

  if (typeof ipcMain.removeHandler === 'function') {
    ipcMain.removeHandler(IPC_CHANNELS.settings.get);
    ipcMain.removeHandler(IPC_CHANNELS.settings.save);
    ipcMain.removeHandler(IPC_CHANNELS.runtime.getStatus);
  }

  ipcMain.handle(IPC_CHANNELS.settings.get, async () => settingsService.getSettings());
  ipcMain.handle(
    IPC_CHANNELS.settings.save,
    async (_event, settings: TranslationClientSettings) => {
      const savedSettings = await settingsService.saveSettings(settings);
      const nextSettings = savedSettings ?? settings;
      await resolvedOptions.onAfterSave?.(nextSettings);
      return nextSettings;
    }
  );

  if (resolvedOptions.runtimeStatusProvider !== undefined) {
    ipcMain.handle(
      IPC_CHANNELS.runtime.getStatus,
      () => resolvedOptions.runtimeStatusProvider?.getRuntimeStatus()
    );
  }
}
