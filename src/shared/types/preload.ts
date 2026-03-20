import type { RuntimeStatus } from './ipc';
import type { PromptSession, PromptSubmission } from './context-prompt';
import type { TranslationClientSettings } from './settings';

export interface ElectronInfo {
  chrome: string;
  electron: string;
  node: string;
  platform: string;
}

export interface TextBridgeApi {
  getSettings: () => Promise<TranslationClientSettings>;
  saveSettings: (settings: TranslationClientSettings) => Promise<TranslationClientSettings>;
  getRuntimeStatus: () => Promise<RuntimeStatus>;
  getContextPromptSession?: () => Promise<PromptSession | null>;
  submitContextPrompt?: (submission: PromptSubmission) => Promise<void>;
  cancelContextPrompt?: () => Promise<void>;
}
