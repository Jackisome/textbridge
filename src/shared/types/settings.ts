import type { ProviderId, ProviderSettingsMap } from './provider';

export type TranslationProviderKind = ProviderId;
export type OutputMode = 'replace-original' | 'show-popup';
export type CaptureMode = 'uia-first' | 'clipboard-first';

export interface TranslationClientSettings {
  sourceLanguage: string;
  targetLanguage: string;
  activeProviderId: ProviderId;
  quickTranslateShortcut: string;
  contextTranslateShortcut: string;
  outputMode: OutputMode;
  captureMode: CaptureMode;
  closeToTray: boolean;
  startMinimized: boolean;
  enableClipboardFallback: boolean;
  enablePopupFallback: boolean;
  providers: ProviderSettingsMap;
}
