export const IPC_CHANNELS = {
  settings: {
    get: 'settings:get',
    save: 'settings:save'
  },
  runtime: {
    getStatus: 'runtime:get-status'
  }
} as const;
