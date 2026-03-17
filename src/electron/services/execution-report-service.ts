import type { ExecutionReport } from '../../core/entities/execution-report';
import type {
  RuntimeExecutionEntry,
  RuntimeHelperState,
  RuntimeStatus
} from '../../shared/types/ipc';
import type { TranslationProviderKind } from '../../shared/types/settings';

export interface ExecutionReportContext {
  sourceText?: string;
  translatedText?: string;
}

export interface CreateExecutionReportServiceOptions {
  maxEntries?: number;
}

export interface ExecutionReportRuntimeStatusInput {
  ready: boolean;
  platform: string;
  activeProvider: TranslationProviderKind;
  registeredShortcuts: string[];
  helperState?: RuntimeHelperState;
  helperLastErrorCode?: string | null;
  helperPid?: number | null;
}

export interface ExecutionReportService {
  record(report: ExecutionReport, context?: ExecutionReportContext): void;
  getRecentExecutions(): RuntimeExecutionEntry[];
  getRuntimeStatus(input: ExecutionReportRuntimeStatusInput): RuntimeStatus;
}

export function createExecutionReportService({
  maxEntries = 10
}: CreateExecutionReportServiceOptions = {}): ExecutionReportService {
  let recentExecutions: RuntimeExecutionEntry[] = [];

  return {
    record(report: ExecutionReport, context: ExecutionReportContext = {}): void {
      const entry = toRuntimeExecutionEntry(report, context);
      recentExecutions = [entry, ...recentExecutions].slice(0, maxEntries);
    },
    getRecentExecutions(): RuntimeExecutionEntry[] {
      return [...recentExecutions];
    },
    getRuntimeStatus(input: ExecutionReportRuntimeStatusInput): RuntimeStatus {
      return {
        ready: input.ready,
        platform: input.platform,
        activeProvider: input.activeProvider,
        registeredShortcuts: [...input.registeredShortcuts],
        helperState: input.helperState ?? 'idle',
        helperLastErrorCode: input.helperLastErrorCode ?? null,
        helperPid: input.helperPid ?? null,
        lastExecution: recentExecutions[0] ?? null,
        recentExecutions: [...recentExecutions]
      };
    }
  };
}

function toRuntimeExecutionEntry(
  report: ExecutionReport,
  context: ExecutionReportContext
): RuntimeExecutionEntry {
  return {
    ...report,
    sourceTextPreview: sanitizeTextPreview(context.sourceText),
    translatedTextPreview: sanitizeTextPreview(context.translatedText)
  };
}

function sanitizeTextPreview(text?: string): string | undefined {
  if (!text) {
    return undefined;
  }

  const normalizedText = text.replace(/\s+/g, ' ').trim();

  if (normalizedText.length === 0) {
    return undefined;
  }

  return normalizedText.length <= 20
    ? normalizedText
    : `${normalizedText.slice(0, 20)}...`;
}
