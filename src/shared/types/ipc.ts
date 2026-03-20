import type { ExecutionReport } from '../../core/entities/execution-report';
import type { TranslationRequest } from '../../core/entities/translation';
import type { PromptSession, PromptSubmission } from './context-prompt';
import type { TranslationClientSettings, TranslationProviderKind } from './settings';

export interface RuntimeExecutionEntry extends ExecutionReport {
  sourceTextPreview?: string;
  translatedTextPreview?: string;
}

export type RuntimeHelperState =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'degraded'
  | 'stopped';

export interface RuntimeStatus {
  ready: boolean;
  platform: string;
  activeProvider: TranslationProviderKind;
  registeredShortcuts: string[];
  helperState: RuntimeHelperState;
  helperLastErrorCode: string | null;
  helperPid: number | null;
  lastExecution: RuntimeExecutionEntry | null;
  recentExecutions: RuntimeExecutionEntry[];
}

export interface PreloadContractShape {
  draftRequest: TranslationRequest | null;
  lastExecution: ExecutionReport | null;
  settingsSnapshot: TranslationClientSettings | null;
  contextPromptSession?: PromptSession | null;
}

export interface DesktopApi {
  getSettings(): Promise<TranslationClientSettings>;
  saveSettings(settings: TranslationClientSettings): Promise<TranslationClientSettings>;
  getRuntimeStatus(): Promise<RuntimeStatus>;
  getContextPromptSession?: () => Promise<PromptSession | null>;
  submitContextPrompt?: (submission: PromptSubmission) => Promise<void>;
  cancelContextPrompt?: () => Promise<void>;
}

export interface ElectronInfo {
  chrome: string;
  electron: string;
  node: string;
  platform: string;
}
