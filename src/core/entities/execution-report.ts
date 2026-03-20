import type { TextCaptureMethod } from './text-capture';
import type { WriteBackMethod } from './write-back';

export type ExecutionWorkflow = 'quick-translation' | 'context-translation';
export type ExecutionStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'fallback-required'
  | 'cancelled';

export interface ExecutionReport {
  id: string;
  workflow: ExecutionWorkflow;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  provider?: string;
  captureMethod?: TextCaptureMethod;
  writeBackMethod?: WriteBackMethod;
  sourceTextLength: number;
  translatedTextLength: number;
  errorCode?: string;
  errorMessage?: string;
}
