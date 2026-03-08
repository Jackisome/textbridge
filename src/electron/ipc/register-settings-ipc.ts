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
}

export function registerSettingsIpc({
  settingsService,
  runtimeStatusProvider
}: RegisterSettingsIpcOptions): void {
  ipcMain.removeHandler(IPC_CHANNELS.settings.get);
  ipcMain.removeHandler(IPC_CHANNELS.settings.save);
  ipcMain.removeHandler(IPC_CHANNELS.runtime.getStatus);

  ipcMain.handle(IPC_CHANNELS.settings.get, () => settingsService.getSettings());
  ipcMain.handle(IPC_CHANNELS.settings.save, (_event, settings: AppSettings) =>
    settingsService.saveSettings(settings)
  );
  ipcMain.handle(IPC_CHANNELS.runtime.getStatus, () => runtimeStatusProvider.getRuntimeStatus());
}
