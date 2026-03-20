export const SETTINGS_IPC_CHANNELS = {
  getSettings: 'settings:get',
  saveSettings: 'settings:save'
} as const;

export const IPC_CHANNELS = {
  settings: {
    get: SETTINGS_IPC_CHANNELS.getSettings,
    save: SETTINGS_IPC_CHANNELS.saveSettings
  },
  contextPrompt: {
    getSession: 'contextPrompt:getSession',
    submit: 'contextPrompt:submit',
    cancel: 'contextPrompt:cancel'
  },
  runtime: {
    getStatus: 'runtime:get-status'
  }
} as const;
