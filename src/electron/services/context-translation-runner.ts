import { executeContextTranslation } from '../../core/use-cases/execute-context-translation';
import type { ExecutionReport } from '../../core/entities/execution-report';
import type { TranslationResult } from '../../core/entities/translation';
import type { AppSettings } from '../../shared/types/settings';
import type { ExecutionReportContext } from './execution-report-service';
import type { PopupService } from './popup-service';

export interface ContextTranslationRunner {
  run(): Promise<ExecutionReport>;
}

export interface ContextTranslationSettingsService {
  getSettings(): Promise<AppSettings>;
}

export interface ContextTranslationSystemInteractionService {
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

export interface ContextTranslationProviderService {
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

export interface CreateContextTranslationRunnerOptions {
  settingsService: ContextTranslationSettingsService;
  systemInteractionService: ContextTranslationSystemInteractionService;
  translationProviderService: ContextTranslationProviderService;
  popupService: PopupService;
  reportRecorder?: {
    record(report: ExecutionReport, context?: ExecutionReportContext): void;
  };
  createReportId?: () => string;
  now?: () => string;
}

export function createContextTranslationRunner({
  settingsService,
  systemInteractionService,
  translationProviderService,
  popupService,
  reportRecorder,
  createReportId = () => crypto.randomUUID(),
  now = () => new Date().toISOString()
}: CreateContextTranslationRunnerOptions): ContextTranslationRunner {
  return {
    async run(): Promise<ExecutionReport> {
      const settings = await settingsService.getSettings();
      const startedAt = now();
      const captureResult = await systemInteractionService.captureSelectedText(settings);

      if (!captureResult.success) {
        const report: ExecutionReport = {
          id: createReportId(),
          workflow: 'context-translation',
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

      const sourceText = captureResult.text ?? '';
      const instructions = await popupService.requestContextInstructions(sourceText);

      if (instructions === null) {
        const report: ExecutionReport = {
          id: createReportId(),
          workflow: 'context-translation',
          status: 'failed',
          startedAt,
          completedAt: now(),
          captureMethod: captureResult.method,
          sourceTextLength: sourceText.length,
          translatedTextLength: 0,
          errorCode: 'CONTEXT_INPUT_CANCELLED',
          errorMessage: 'Context instructions were cancelled.'
        };

        reportRecorder?.record(report, {
          sourceText
        });
        return report;
      }

      const translationRequestResult = executeContextTranslation({
        text: sourceText,
        instructions,
        settings
      });

      if (!translationRequestResult.success) {
        const report: ExecutionReport = {
          id: createReportId(),
          workflow: 'context-translation',
          status: 'failed',
          startedAt,
          completedAt: now(),
          captureMethod: captureResult.method,
          sourceTextLength: sourceText.length,
          translatedTextLength: 0,
          errorCode: translationRequestResult.error.code,
          errorMessage: translationRequestResult.error.message
        };

        reportRecorder?.record(report, {
          sourceText
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
        workflow: 'context-translation',
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
        await popupService.showFallbackResult({
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
