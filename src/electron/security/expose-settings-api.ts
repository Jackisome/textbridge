import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { DesktopApi } from '../../shared/types/ipc';

export function exposeSettingsApi(): DesktopApi {
  return {
    getSettings: async () => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
    saveSettings: async (settings) => ipcRenderer.invoke(IPC_CHANNELS.settings.save, settings),
    getRuntimeStatus: async () => ipcRenderer.invoke(IPC_CHANNELS.runtime.getStatus),
    getContextPromptSession: async () =>
      ipcRenderer.invoke(IPC_CHANNELS.contextPrompt.getSession),
    submitContextPrompt: async (submission) =>
      ipcRenderer.invoke(IPC_CHANNELS.contextPrompt.submit, submission),
    cancelContextPrompt: async () => ipcRenderer.invoke(IPC_CHANNELS.contextPrompt.cancel)
  };
}
