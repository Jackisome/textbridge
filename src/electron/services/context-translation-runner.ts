import { executeContextTranslation } from '../../core/use-cases/execute-context-translation';
import type { ExecutionReport } from '../../core/entities/execution-report';
import type { TranslationResult } from '../../core/entities/translation';
import type { RestoreTarget, SelectionContextCapture } from '../../shared/types/context-prompt';
import type { OutputMode, TranslationClientSettings } from '../../shared/types/settings';
import type { ExecutionReportContext } from './execution-report-service';
import type { PopupService } from './popup-service';

export interface ContextTranslationRunner {
  run(): Promise<ExecutionReport>;
}

export interface ContextTranslationSettingsService {
  getSettings(): Promise<TranslationClientSettings>;
}

export interface ContextTranslationSystemInteractionService {
  captureSelectionContext(settings?: TranslationClientSettings): Promise<{
    success: boolean;
    data?: SelectionContextCapture;
    errorCode?: string;
    errorMessage?: string;
  }>;
  restoreSelectionTarget(target: RestoreTarget): Promise<{
    success: boolean;
    restored: boolean;
    errorCode?: string;
    errorMessage?: string;
  }>;
  writeTranslatedText(
    text: string,
    settings?: TranslationClientSettings,
    expectedSourceText?: string
  ): Promise<{
    success: boolean;
    method: ExecutionReport['writeBackMethod'];
    errorCode?: string;
    errorMessage?: string;
  }>;
  copyToClipboard(text: string): Promise<void>;
}

export interface ContextTranslationProviderService {
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
      const reportId = createReportId();
      const captureResult = await systemInteractionService.captureSelectionContext(settings);
      const selectionContext = captureResult.data;
      const sourceText = selectionContext?.sourceText ?? '';

      if (!captureResult.success || !selectionContext) {
        const report: ExecutionReport = {
          id: reportId,
          workflow: 'context-translation',
          status: 'failed',
          startedAt,
          completedAt: now(),
          captureMethod: selectionContext?.captureMethod,
          sourceTextLength: 0,
          translatedTextLength: 0,
          errorCode: captureResult.errorCode,
          errorMessage: captureResult.errorMessage
        };

        reportRecorder?.record(report);
        return report;
      }

      const instructions = await popupService.requestContextInstructions(
        sourceText,
        selectionContext.anchor
      );

      if (instructions === null) {
        const report: ExecutionReport = {
          id: reportId,
          workflow: 'context-translation',
          status: 'cancelled',
          startedAt,
          completedAt: now(),
          captureMethod: selectionContext.captureMethod,
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
          id: reportId,
          workflow: 'context-translation',
          status: 'failed',
          startedAt,
          completedAt: now(),
          captureMethod: selectionContext.captureMethod,
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

      const restoreDecision = await resolveRestoreDecision({
        selectionContext,
        systemInteractionService
      });

      if (!restoreDecision.canWriteBack) {
        return presentPopupFallback({
          captureMethod: selectionContext.captureMethod,
          errorCode: restoreDecision.errorCode,
          errorMessage: restoreDecision.errorMessage,
          now,
          popupService,
          provider: translationResult.provider,
          reportId,
          reportRecorder,
          sourceText,
          startedAt,
          systemInteractionService,
          translatedText: translationResult.translatedText
        });
      }

      const writeBackResult = await systemInteractionService.writeTranslatedText(
        translationResult.translatedText,
        settings,
        sourceText
      );

      const baseReport: ExecutionReport = {
        id: reportId,
        workflow: 'context-translation',
        status: writeBackResult.success ? 'completed' : 'failed',
        startedAt,
        completedAt: now(),
        provider: translationResult.provider,
        captureMethod: selectionContext.captureMethod,
        writeBackMethod: writeBackResult.method,
        sourceTextLength: sourceText.length,
        translatedTextLength: translationResult.translatedText.length
      };

      if (writeBackResult.success) {
        reportRecorder?.record(baseReport, {
          sourceText,
          translatedText: translationResult.translatedText
        });
        return baseReport;
      }

      if (writeBackResult.method === 'popup-fallback') {
        return presentPopupFallback({
          captureMethod: selectionContext.captureMethod,
          errorCode: writeBackResult.errorCode,
          errorMessage: writeBackResult.errorMessage,
          now,
          popupService,
          provider: translationResult.provider,
          reportId,
          reportRecorder,
          sourceText,
          startedAt,
          systemInteractionService,
          translatedText: translationResult.translatedText
        });
      }

      const report: ExecutionReport = {
        ...baseReport,
        errorCode: writeBackResult.errorCode,
        errorMessage: writeBackResult.errorMessage
      };

      reportRecorder?.record(report, {
        sourceText,
        translatedText: translationResult.translatedText
      });
      return report;
    }
  };
}

async function resolveRestoreDecision({
  selectionContext,
  systemInteractionService
}: {
  selectionContext: SelectionContextCapture;
  systemInteractionService: ContextTranslationSystemInteractionService;
}): Promise<
  | { canWriteBack: true }
  | { canWriteBack: false; errorCode: string; errorMessage: string }
> {
  if (
    selectionContext.restoreTarget === null ||
    !selectionContext.capabilities.canRestoreTargetAfterPrompt
  ) {
    return {
      canWriteBack: false,
      errorCode: 'RESTORE_TARGET_UNSUPPORTED',
      errorMessage:
        'The captured target cannot be safely restored after prompt submission.'
    };
  }

  const restoreResult = await systemInteractionService.restoreSelectionTarget(
    selectionContext.restoreTarget
  );

  if (!restoreResult.success || !restoreResult.restored) {
    return {
      canWriteBack: false,
      errorCode: restoreResult.errorCode ?? 'RESTORE_TARGET_FAILED',
      errorMessage:
        restoreResult.errorMessage ??
        'Failed to restore the original selection target.'
    };
  }

  if (!selectionContext.capabilities.canAutoWriteBackAfterPrompt) {
    return {
      canWriteBack: false,
      errorCode: 'WRITE_BACK_UNSUPPORTED',
      errorMessage:
        'Automatic write-back after prompt is not supported for the captured target.'
    };
  }

  return {
    canWriteBack: true
  };
}

async function presentPopupFallback({
  captureMethod,
  errorCode,
  errorMessage,
  now,
  popupService,
  provider,
  reportId,
  reportRecorder,
  sourceText,
  startedAt,
  systemInteractionService,
  translatedText
}: {
  captureMethod: ExecutionReport['captureMethod'];
  errorCode?: string;
  errorMessage?: string;
  now: () => string;
  popupService: PopupService;
  provider: string;
  reportId: string;
  reportRecorder?: {
    record(report: ExecutionReport, context?: ExecutionReportContext): void;
  };
  sourceText: string;
  startedAt: string;
  systemInteractionService: ContextTranslationSystemInteractionService;
  translatedText: string;
}): Promise<ExecutionReport> {
  const fallbackReport: ExecutionReport = {
    id: reportId,
    workflow: 'context-translation',
    status: 'fallback-required',
    startedAt,
    completedAt: now(),
    provider,
    captureMethod,
    writeBackMethod: 'popup-fallback',
    sourceTextLength: sourceText.length,
    translatedTextLength: translatedText.length,
    errorCode,
    errorMessage
  };

  await systemInteractionService.copyToClipboard(translatedText);
  await popupService.showFallbackResult({
    translatedText,
    sourceText,
    report: fallbackReport
  });

  reportRecorder?.record(fallbackReport, {
    sourceText,
    translatedText
  });

  return fallbackReport;
}
