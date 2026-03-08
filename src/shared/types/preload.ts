import type { TranslationClientSettings } from './settings';

export interface ElectronInfo {
  chrome: string;
  electron: string;
  node: string;
  platform: string;
}

export interface TextBridgeApi {
  getSettings: () => Promise<TranslationClientSettings>;
  saveSettings: (settings: TranslationClientSettings) => Promise<void>;
}
