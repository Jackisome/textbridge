import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { DesktopApi } from '../../shared/types/ipc';

export function exposeSettingsApi(): DesktopApi {
  return {
    getSettings: async () => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
    saveSettings: async (settings) => ipcRenderer.invoke(IPC_CHANNELS.settings.save, settings),
    getRuntimeStatus: async () => ipcRenderer.invoke(IPC_CHANNELS.runtime.getStatus)
  };
}
