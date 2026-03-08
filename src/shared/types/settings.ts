export type TranslationProviderKind = 'mock' | 'http';
export type OutputMode = 'replace-original' | 'append-translation';
export type CaptureMethodPreference = 'uia' | 'clipboard';

export interface ProviderSettings {
  kind: TranslationProviderKind;
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface ShortcutSettings {
  quickTranslate: string;
  contextTranslate: string;
}

export interface CaptureSettings {
  preferredMethod: CaptureMethodPreference;
  allowClipboardFallback: boolean;
}

export interface WriteBackSettings {
  outputMode: OutputMode;
  allowPasteFallback: boolean;
  allowPopupFallback: boolean;
}

export interface UiSettings {
  closeMainWindowToTray: boolean;
  startMinimized: boolean;
}

export interface AppSettings {
  sourceLanguage: string;
  targetLanguage: string;
  provider: ProviderSettings;
  shortcuts: ShortcutSettings;
  capture: CaptureSettings;
  writeBack: WriteBackSettings;
  ui: UiSettings;
}
