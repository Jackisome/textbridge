export type Win32CaptureMethod = 'uia' | 'clipboard';
export type Win32WriteMethod = 'replace-selection' | 'paste-translation';

export interface Win32PromptAnchorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Win32PromptAnchor {
  kind: 'selection-rect' | 'control-rect' | 'window-rect' | 'cursor' | 'unknown';
  bounds?: Win32PromptAnchorBounds;
  displayId?: string;
}

export interface Win32SelectionContextCapabilities {
  canPositionPromptNearSelection: boolean;
  canRestoreTargetAfterPrompt: boolean;
  canAutoWriteBackAfterPrompt: boolean;
}

export interface Win32ProtocolError {
  code: string;
  message: string;
}

export type Win32Request =
  | {
      kind: 'capture-text';
      method: Win32CaptureMethod;
    }
  | {
      kind: 'capture-selection-context';
      method: Win32CaptureMethod;
    }
  | {
      kind: 'write-text';
      method: Win32WriteMethod;
      text: string;
      expectedSourceText?: string;
    }
  | {
      kind: 'restore-target';
      token: string;
    };

export type Win32Response =
  | {
      kind: 'capture-text';
      ok: boolean;
      method: Win32CaptureMethod;
      text?: string;
      error?: Win32ProtocolError;
    }
  | {
      kind: 'capture-selection-context';
      ok: boolean;
      method: Win32CaptureMethod;
      text?: string;
      anchor?: Win32PromptAnchor;
      restoreTarget?: {
        token: string;
      };
      capabilities?: Win32SelectionContextCapabilities;
      error?: Win32ProtocolError;
    }
  | {
      kind: 'write-text';
      ok: boolean;
      method: Win32WriteMethod;
      error?: Win32ProtocolError;
    }
  | {
      kind: 'restore-target';
      ok: boolean;
      restored: boolean;
      error?: Win32ProtocolError;
    };
