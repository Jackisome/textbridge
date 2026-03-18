export type Win32CaptureMethod = 'uia' | 'clipboard';
export type Win32WriteMethod = 'replace-selection' | 'paste-translation';

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
      kind: 'write-text';
      method: Win32WriteMethod;
      text: string;
      expectedSourceText?: string;
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
      kind: 'write-text';
      ok: boolean;
      method: Win32WriteMethod;
      error?: Win32ProtocolError;
    };
