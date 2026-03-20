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

export type PromptSessionResult = PromptSubmittedResult | PromptCancelledResult;
