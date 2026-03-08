import { contextBridge, ipcRenderer } from 'electron';

import { SETTINGS_IPC_CHANNELS } from '../shared/constants/ipc';
import type { TranslationClientSettings } from '../shared/types/settings';

contextBridge.exposeInMainWorld('electronInfo', {
  chrome: process.versions.chrome,
  electron: process.versions.electron,
  node: process.versions.node,
  platform: process.platform
});

contextBridge.exposeInMainWorld('textBridge', {
  getSettings: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.getSettings),
  saveSettings: (settings: TranslationClientSettings) =>
    ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.saveSettings, settings)
});
