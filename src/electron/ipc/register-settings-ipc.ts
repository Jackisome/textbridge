import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { RuntimeStatus } from '../../shared/types/ipc';
import type { AppSettings } from '../../shared/types/settings';
import type { SettingsService } from '../services/settings-service';

export interface RuntimeStatusProvider {
  getRuntimeStatus(): Promise<RuntimeStatus>;
}

export interface RegisterSettingsIpcOptions {
  settingsService: SettingsService;
  runtimeStatusProvider: RuntimeStatusProvider;
  onSettingsSaved?: (settings: AppSettings) => void | Promise<void>;
}

export function registerSettingsIpc({
  settingsService,
  runtimeStatusProvider,
  onSettingsSaved
}: RegisterSettingsIpcOptions): void {
  ipcMain.removeHandler(IPC_CHANNELS.settings.get);
  ipcMain.removeHandler(IPC_CHANNELS.settings.save);
  ipcMain.removeHandler(IPC_CHANNELS.runtime.getStatus);

  ipcMain.handle(IPC_CHANNELS.settings.get, () => settingsService.getSettings());
  ipcMain.handle(IPC_CHANNELS.settings.save, async (_event, settings: AppSettings) => {
    const savedSettings = await settingsService.saveSettings(settings);
    await onSettingsSaved?.(savedSettings);
    return savedSettings;
  });
  ipcMain.handle(IPC_CHANNELS.runtime.getStatus, () => runtimeStatusProvider.getRuntimeStatus());
}
