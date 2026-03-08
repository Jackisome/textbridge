import type { TranslationClientSettings } from '../types/settings';

export const defaultTranslationClientSettings: TranslationClientSettings = {
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  providerKind: 'mock',
  httpEndpoint: 'https://api.openai.com/v1/responses',
  apiKey: '',
  model: 'gpt-4.1-mini',
  requestTimeoutMs: 20000,
  quickTranslateShortcut: 'CommandOrControl+Shift+K',
  contextTranslateShortcut: 'CommandOrControl+Shift+L',
  outputMode: 'replace-original',
  captureMode: 'uia-first',
  closeToTray: true,
  startMinimized: false,
  enableClipboardFallback: true,
  enablePopupFallback: true
};
