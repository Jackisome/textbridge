import type { ExecutionReport } from '../../core/entities/execution-report';

export interface PopupFallbackPayload {
  translatedText: string;
  sourceText: string;
  report: ExecutionReport;
}

export interface PopupService {
  requestContextInstructions(sourceText: string): Promise<string | null>;
  showFallbackResult(payload: PopupFallbackPayload): Promise<void>;
  showSettings(): Promise<void>;
}

export interface CreatePopupServiceOptions {
  requestContextInstructions?: (sourceText: string) => Promise<string | null>;
  showFallbackResult?: (payload: PopupFallbackPayload) => Promise<void> | void;
  showSettings?: () => Promise<void> | void;
}

export function createPopupService({
  requestContextInstructions,
  showFallbackResult,
  showSettings
}: CreatePopupServiceOptions = {}): PopupService {
  return {
    requestContextInstructions(sourceText: string): Promise<string | null> {
      return requestContextInstructions ? requestContextInstructions(sourceText) : Promise.resolve(null);
    },
    async showFallbackResult(payload: PopupFallbackPayload): Promise<void> {
      await showFallbackResult?.(payload);
    },
    async showSettings(): Promise<void> {
      await showSettings?.();
    }
  };
}
