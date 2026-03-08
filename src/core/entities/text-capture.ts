export type TextCaptureMethod = 'uia' | 'clipboard' | 'manual-entry';

export interface TextCaptureResult {
  success: boolean;
  text?: string;
  method: TextCaptureMethod;
  errorCode?: string;
  errorMessage?: string;
}
