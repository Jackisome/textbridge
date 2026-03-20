import { describe, expect, it } from 'vitest';
import { createExecutionReportService } from './execution-report-service';

describe('createExecutionReportService', () => {
  it('keeps a limited number of recent execution records and does not leak full source or translated text', () => {
    const service = createExecutionReportService({
      maxEntries: 2
    });

    service.record(
      {
        id: 'report-1',
        workflow: 'quick-translation',
        status: 'completed',
        startedAt: '2026-03-08T12:00:00.000Z',
        completedAt: '2026-03-08T12:00:01.000Z',
        provider: 'mock',
        captureMethod: 'uia',
        writeBackMethod: 'replace-selection',
        sourceTextLength: 63,
        translatedTextLength: 58
      },
      {
        sourceText:
          'This is a confidential original paragraph that must never be stored in full.',
        translatedText:
          '这是一个保密的原文段落，不应该以完整文本形式被持久化到运行状态中。'
      }
    );

    service.record({
      id: 'report-2',
      workflow: 'quick-translation',
      status: 'failed',
      startedAt: '2026-03-08T12:01:00.000Z',
      completedAt: '2026-03-08T12:01:01.000Z',
      provider: 'mock',
      captureMethod: 'uia',
      writeBackMethod: 'popup-fallback',
      sourceTextLength: 3,
      translatedTextLength: 0,
      errorCode: 'EMPTY_TEXT',
      errorMessage: 'Text to translate is required.'
    });

    service.record({
      id: 'report-3',
      workflow: 'context-translation',
      status: 'fallback-required',
      startedAt: '2026-03-08T12:02:00.000Z',
      completedAt: '2026-03-08T12:02:01.000Z',
      provider: 'http',
      captureMethod: 'clipboard',
      writeBackMethod: 'popup-fallback',
      sourceTextLength: 12,
      translatedTextLength: 18
    });

    const runtimeStatus = service.getRuntimeStatus({
      ready: true,
      platform: 'win32',
      activeProvider: 'http',
      registeredShortcuts: ['CommandOrControl+Shift+1', 'CommandOrControl+Shift+2'],
      helperState: 'degraded',
      helperLastErrorCode: 'HELPER_TIMEOUT',
      helperPid: 2048
    });

    expect(runtimeStatus.recentExecutions.map((entry) => entry.id)).toEqual([
      'report-3',
      'report-2'
    ]);
    expect(runtimeStatus.lastExecution?.id).toBe('report-3');
    expect(runtimeStatus.recentExecutions).toHaveLength(2);
    expect(runtimeStatus.recentExecutions[0].sourceTextPreview).toBeUndefined();
    expect(runtimeStatus.recentExecutions[1].translatedTextPreview).toBeUndefined();
    expect(runtimeStatus.recentExecutions.some((entry) =>
      entry.sourceTextPreview ===
      'This is a confidential original paragraph that must never be stored in full.'
    )).toBe(false);
    expect(runtimeStatus.helperState).toBe('degraded');
    expect(runtimeStatus.helperLastErrorCode).toBe('HELPER_TIMEOUT');
    expect(runtimeStatus.helperPid).toBe(2048);
  });

  it('defaults helper runtime snapshot to idle and null values when omitted', () => {
    const service = createExecutionReportService();

    const runtimeStatus = service.getRuntimeStatus({
      ready: false,
      platform: 'win32',
      activeProvider: 'mock',
      registeredShortcuts: []
    });

    expect(runtimeStatus.helperState).toBe('idle');
    expect(runtimeStatus.helperLastErrorCode).toBeNull();
    expect(runtimeStatus.helperPid).toBeNull();
  });

  it('records cancelled executions without treating them as failures', () => {
    const service = createExecutionReportService();

    service.record(
      {
        id: 'report-cancelled',
        workflow: 'context-translation',
        status: 'cancelled',
        startedAt: '2026-03-20T10:00:00.000Z',
        completedAt: '2026-03-20T10:00:03.000Z',
        captureMethod: 'uia',
        sourceTextLength: 5,
        translatedTextLength: 0,
        errorCode: 'CONTEXT_INPUT_CANCELLED',
        errorMessage: 'Context instructions were cancelled.'
      },
      {
        sourceText: 'hello'
      }
    );

    const [entry] = service.getRecentExecutions();

    expect(entry).toMatchObject({
      id: 'report-cancelled',
      workflow: 'context-translation',
      status: 'cancelled',
      errorCode: 'CONTEXT_INPUT_CANCELLED',
      errorMessage: 'Context instructions were cancelled.',
      sourceTextPreview: 'hello'
    });
    expect(entry.translatedTextPreview).toBeUndefined();
  });
});
