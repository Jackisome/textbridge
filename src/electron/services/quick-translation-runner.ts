import { executeQuickTranslation } from '../../core/use-cases/execute-quick-translation';
import type { ExecutionReport } from '../../core/entities/execution-report';
import type { TranslationResult } from '../../core/entities/translation';
import type { OutputMode, TranslationClientSettings } from '../../shared/types/settings';
import type { ExecutionReportContext } from './execution-report-service';

export interface QuickTranslationRunner {
  run(): Promise<ExecutionReport>;
}

export interface QuickTranslationRunnerSettingsService {
  getSettings(): Promise<TranslationClientSettings>;
}

export interface QuickTranslationRunnerSystemInteractionService {
  captureSelectedText(settings?: TranslationClientSettings): Promise<{
    success: boolean;
    method: ExecutionReport['captureMethod'];
    text?: string;
    errorCode?: string;
    errorMessage?: string;
  }>;
  writeTranslatedText(text: string, settings?: TranslationClientSettings): Promise<{
    success: boolean;
    method: ExecutionReport['writeBackMethod'];
    errorCode?: string;
    errorMessage?: string;
  }>;
  copyToClipboard(text: string): Promise<void>;
}

export interface QuickTranslationRunnerTranslationProviderService {
  translateWithSettings(
    settings: TranslationClientSettings,
    request: {
      text: string;
      sourceLanguage: string;
      targetLanguage: string;
      instructions?: string;
      outputMode: OutputMode;
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
  reportRecorder?: {
    record(report: ExecutionReport, context?: ExecutionReportContext): void;
  };
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
  reportRecorder,
  createReportId = () => crypto.randomUUID(),
  now = () => new Date().toISOString()
}: CreateQuickTranslationRunnerOptions): QuickTranslationRunner {
  return {
    async run(): Promise<ExecutionReport> {
      const settings = await settingsService.getSettings();
      const startedAt = now();
      const captureResult = await systemInteractionService.captureSelectedText(settings);

      if (!captureResult.success) {
        const report: ExecutionReport = {
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

        reportRecorder?.record(report);
        return report;
      }

      const translationRequestResult = executeQuickTranslation({
        text: captureResult.text ?? '',
        settings
      });

      if (!translationRequestResult.success) {
        const report: ExecutionReport = {
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

        reportRecorder?.record(report, {
          sourceText: captureResult.text
        });
        return report;
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
        reportRecorder?.record(baseReport, {
          sourceText: translationRequestResult.request.text,
          translatedText: translationResult.translatedText
        });
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

        reportRecorder?.record(fallbackReport, {
          sourceText: translationRequestResult.request.text,
          translatedText: translationResult.translatedText
        });
        return fallbackReport;
      }

      const report: ExecutionReport = {
        ...baseReport,
        errorCode: writeBackResult.errorCode,
        errorMessage: writeBackResult.errorMessage
      };

      reportRecorder?.record(report, {
        sourceText: translationRequestResult.request.text,
        translatedText: translationResult.translatedText
      });
      return report;
    }
  };
}
