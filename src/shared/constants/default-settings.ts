import type { AppSettings } from '../types/settings';

export const DEFAULT_SETTINGS: AppSettings = {
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  provider: {
    kind: 'mock',
    endpoint: '',
    apiKey: '',
    model: '',
    timeoutMs: 15000
  },
  shortcuts: {
    quickTranslate: 'CommandOrControl+Shift+1',
    contextTranslate: 'CommandOrControl+Shift+2'
  },
  capture: {
    preferredMethod: 'uia',
    allowClipboardFallback: true
  },
  writeBack: {
    outputMode: 'replace-original',
    allowPasteFallback: true,
    allowPopupFallback: true
  },
  ui: {
    closeMainWindowToTray: true,
    startMinimized: false
  }
};
