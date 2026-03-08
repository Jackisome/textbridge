import { ipcMain } from 'electron';

import { SETTINGS_IPC_CHANNELS } from '../../shared/constants/ipc';
import type { TranslationClientSettings } from '../../shared/types/settings';
import type { SettingsService } from '../services/settings-service';

interface RegisterSettingsIpcOptions {
  onAfterSave?: (settings: TranslationClientSettings) => void | Promise<void>;
}

export function registerSettingsIpc(
  settingsService: SettingsService,
  options: RegisterSettingsIpcOptions = {}
): void {
  ipcMain.handle(SETTINGS_IPC_CHANNELS.getSettings, async () => settingsService.loadSettings());
  ipcMain.handle(
    SETTINGS_IPC_CHANNELS.saveSettings,
    async (_event, settings: TranslationClientSettings) => {
      await settingsService.saveSettings(settings);
      await options.onAfterSave?.(settings);
    }
  );
}
