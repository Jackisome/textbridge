import type { RuntimeStatus } from '../../shared/types/ipc';
import type { TranslationClientSettings } from '../../shared/types/settings';
import type { ExecutionReport } from '../entities/execution-report';
import type { TextCaptureResult } from '../entities/text-capture';
import type { TranslationRequest, TranslationResult } from '../entities/translation';
import type { WriteBackResult } from '../entities/write-back';

export interface TranslationProvider {
  readonly kind: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export interface SettingsStore {
  load(): Promise<TranslationClientSettings>;
  save(settings: TranslationClientSettings): Promise<TranslationClientSettings>;
}

export interface RuntimeStatusProvider {
  getRuntimeStatus(): Promise<RuntimeStatus>;
}

export interface SystemInteractionPort {
  captureSelectedText(): Promise<TextCaptureResult>;
  writeTranslatedText(text: string): Promise<WriteBackResult>;
}

export interface ExecutionReporter {
  record(report: ExecutionReport): Promise<void> | void;
}
