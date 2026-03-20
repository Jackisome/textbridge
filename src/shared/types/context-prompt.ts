export interface PromptAnchorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PromptAnchor {
  kind: 'selection-rect' | 'control-rect' | 'window-rect' | 'cursor' | 'unknown';
  bounds?: PromptAnchorBounds;
  displayId?: string;
}

export interface RestoreTarget {
  platform: 'win32' | 'darwin' | 'linux';
  token: string;
}

export interface SelectionContextCapabilities {
  canPositionPromptNearSelection: boolean;
  canRestoreTargetAfterPrompt: boolean;
  canAutoWriteBackAfterPrompt: boolean;
}

export interface SelectionContextCapture {
  sourceText: string;
  captureMethod: 'uia' | 'clipboard' | 'manual-entry';
  anchor: PromptAnchor;
  restoreTarget: RestoreTarget | null;
  capabilities: SelectionContextCapabilities;
}

export interface PromptSession {
  sourceText: string;
  anchor: PromptAnchor;
}

export interface PromptSubmission {
  instructions: string;
}

export interface PromptSubmittedResult {
  status: 'submitted';
  instructions: string;
}

export interface PromptCancelledResult {
  status: 'cancelled';
}

export interface PromptClearedResult {
  status: 'cleared';
}

export interface PromptSessionAlreadyActiveError {
  status: 'already-active';
  message: string;
}

export type PromptSessionResult =
  | PromptSubmittedResult
  | PromptCancelledResult
  | PromptClearedResult;

export type PromptSessionOpenError = PromptSessionAlreadyActiveError;
