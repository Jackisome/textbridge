import { executeQuickTranslation } from '../../core/use-cases/execute-quick-translation';
import type { ExecutionReport } from '../../core/entities/execution-report';
import type { TranslationResult } from '../../core/entities/translation';
import type { AppSettings } from '../../shared/types/settings';

export interface QuickTranslationRunner {
  run(): Promise<ExecutionReport>;
}

export interface QuickTranslationRunnerSettingsService {
  getSettings(): Promise<AppSettings>;
}

export interface QuickTranslationRunnerSystemInteractionService {
  captureSelectedText(settings?: AppSettings): Promise<{
    success: boolean;
    method: ExecutionReport['captureMethod'];
    text?: string;
    errorCode?: string;
    errorMessage?: string;
  }>;
  writeTranslatedText(text: string, settings?: AppSettings): Promise<{
    success: boolean;
    method: ExecutionReport['writeBackMethod'];
    errorCode?: string;
    errorMessage?: string;
  }>;
  copyToClipboard(text: string): Promise<void>;
}

export interface QuickTranslationRunnerTranslationProviderService {
  translateWithSettings(
    settings: AppSettings,
    request: {
      text: string;
      sourceLanguage: string;
      targetLanguage: string;
      instructions?: string;
      outputMode: AppSettings['writeBack']['outputMode'];
    }
  ): Promise<TranslationResult>;
}

export interface PopupFallbackPresenter {
  showResult(payload: {
    translatedText: string;
    sourceText: string;
    report: ExecutionReport;
  }): Promise<void> | void;
}

export interface CreateQuickTranslationRunnerOptions {
  settingsService: QuickTranslationRunnerSettingsService;
  systemInteractionService: QuickTranslationRunnerSystemInteractionService;
  translationProviderService: QuickTranslationRunnerTranslationProviderService;
  popupFallbackPresenter?: PopupFallbackPresenter;
  createReportId?: () => string;
  now?: () => string;
}

export function createQuickTranslationRunner({
  settingsService,
  systemInteractionService,
  translationProviderService,
  popupFallbackPresenter = {
    showResult() {}
  },
  createReportId = () => crypto.randomUUID(),
  now = () => new Date().toISOString()
}: CreateQuickTranslationRunnerOptions): QuickTranslationRunner {
  return {
    async run(): Promise<ExecutionReport> {
      const settings = await settingsService.getSettings();
      const startedAt = now();
      const captureResult = await systemInteractionService.captureSelectedText(settings);

      if (!captureResult.success) {
        return {
          id: createReportId(),
          workflow: 'quick-translation',
          status: 'failed',
          startedAt,
          completedAt: now(),
          captureMethod: captureResult.method,
          sourceTextLength: 0,
          translatedTextLength: 0,
          errorCode: captureResult.errorCode,
          errorMessage: captureResult.errorMessage
        };
      }

      const translationRequestResult = executeQuickTranslation({
        text: captureResult.text ?? '',
        settings
      });

      if (!translationRequestResult.success) {
        return {
          id: createReportId(),
          workflow: 'quick-translation',
          status: 'failed',
          startedAt,
          completedAt: now(),
          captureMethod: captureResult.method,
          sourceTextLength: 0,
          translatedTextLength: 0,
          errorCode: translationRequestResult.error.code,
          errorMessage: translationRequestResult.error.message
        };
      }

      const translationResult = await translationProviderService.translateWithSettings(
        settings,
        translationRequestResult.request
      );
      const writeBackResult = await systemInteractionService.writeTranslatedText(
        translationResult.translatedText,
        settings
      );

      const baseReport: ExecutionReport = {
        id: createReportId(),
        workflow: 'quick-translation',
        status: writeBackResult.success ? 'completed' : 'failed',
        startedAt,
        completedAt: now(),
        provider: translationResult.provider,
        captureMethod: captureResult.method,
        writeBackMethod: writeBackResult.method,
        sourceTextLength: translationRequestResult.request.text.length,
        translatedTextLength: translationResult.translatedText.length
      };

      if (writeBackResult.success) {
        return baseReport;
      }

      if (writeBackResult.method === 'popup-fallback') {
        const fallbackReport: ExecutionReport = {
          ...baseReport,
          status: 'fallback-required',
          errorCode: writeBackResult.errorCode,
          errorMessage: writeBackResult.errorMessage
        };

        await systemInteractionService.copyToClipboard(translationResult.translatedText);
        await popupFallbackPresenter.showResult({
          translatedText: translationResult.translatedText,
          sourceText: translationRequestResult.request.text,
          report: fallbackReport
        });

        return fallbackReport;
      }

      return {
        ...baseReport,
        errorCode: writeBackResult.errorCode,
        errorMessage: writeBackResult.errorMessage
      };
    }
  };
}
