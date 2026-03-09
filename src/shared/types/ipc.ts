import type { ExecutionReport } from '../../core/entities/execution-report';
import type { TranslationRequest } from '../../core/entities/translation';
import type { AppSettings, TranslationProviderKind } from './settings';

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
  settingsSnapshot: AppSettings | null;
}

export interface DesktopApi {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  getRuntimeStatus(): Promise<RuntimeStatus>;
}

export interface ElectronInfo {
  chrome: string;
  electron: string;
  node: string;
  platform: string;
}
