export type ProviderKind = 'mock' | 'http';

export type OutputMode = 'replace-original' | 'show-popup';

export type CaptureMode = 'uia-first' | 'clipboard-first';

export interface TranslationClientSettings {
  sourceLanguage: string;
  targetLanguage: string;
  providerKind: ProviderKind;
  httpEndpoint: string;
  apiKey: string;
  model: string;
  requestTimeoutMs: number;
  quickTranslateShortcut: string;
  contextTranslateShortcut: string;
  outputMode: OutputMode;
  captureMode: CaptureMode;
  closeToTray: boolean;
  startMinimized: boolean;
  enableClipboardFallback: boolean;
  enablePopupFallback: boolean;
}
