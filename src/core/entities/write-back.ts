export type WriteBackMethod =
  | 'replace-selection'
  | 'paste-translation'
  | 'popup-fallback';

export interface WriteBackResult {
  success: boolean;
  method: WriteBackMethod;
  errorCode?: string;
  errorMessage?: string;
}
