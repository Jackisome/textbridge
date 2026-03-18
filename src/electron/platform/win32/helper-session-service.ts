import { spawn } from 'node:child_process';
import type { RuntimeHelperState } from '../../../shared/types/ipc';
import type { DiagnosticLogService } from '../../services/diagnostic-log-service';
import {
  createStdIoJsonClient,
  StdIoJsonClientError,
  type CreateStdIoJsonClientOptions,
  type StdIoJsonClient,
  type StdIoJsonTransport
} from '../common/stdio-json-client';
import {
  toHelperRequest,
  type HelperRequest,
  type HelperRequestKind,
  type HelperResponse
} from '../common/helper-protocol';
import {
  resolveWin32HelperLaunch,
  type Win32HelperLaunchCommand
} from './helper-path';

export interface Win32HelperSessionSnapshot {
  helperState: RuntimeHelperState;
  helperLastErrorCode: string | null;
  helperPid: number | null;
}

export interface SpawnedWin32HelperProcess {
  pid: number | null;
  transport: StdIoJsonTransport;
  dispose(): Promise<void> | void;
}

export type SpawnWin32HelperProcess = (
  command: Win32HelperLaunchCommand
) => SpawnedWin32HelperProcess;

export interface Win32HelperSessionSendOptions {
  timeoutMs?: number;
}

export interface Win32HelperSessionService {
  send(
    kind: HelperRequestKind,
    payload: Record<string, unknown>,
    options?: Win32HelperSessionSendOptions
  ): Promise<HelperResponse>;
  getSnapshot(): Win32HelperSessionSnapshot;
  dispose(): Promise<void>;
}

export interface CreateWin32HelperSessionServiceOptions {
  isPackaged: boolean;
  resourcesPath?: string;
  requestTimeoutMs?: number;
  spawnHelperProcess?: SpawnWin32HelperProcess;
  createStdIoClient?: (
    options: CreateStdIoJsonClientOptions
  ) => StdIoJsonClient;
  logger?: Pick<DiagnosticLogService, 'debug' | 'warn' | 'error'>;
}

interface ActiveSession {
  client: StdIoJsonClient;
  process: SpawnedWin32HelperProcess;
}

type SessionLogger = Pick<DiagnosticLogService, 'debug' | 'warn' | 'error'>;

const noopLogger: Pick<DiagnosticLogService, 'debug' | 'warn' | 'error'> = {
  debug: async () => {},
  warn: async () => {},
  error: async () => {}
};

export function createWin32HelperSessionService({
  isPackaged,
  resourcesPath,
  requestTimeoutMs = 5_000,
  spawnHelperProcess = defaultSpawnWin32HelperProcess,
  createStdIoClient = createStdIoJsonClient,
  logger = noopLogger
}: CreateWin32HelperSessionServiceOptions): Win32HelperSessionService {
  let activeSession: ActiveSession | null = null;
  let startingPromise: Promise<void> | null = null;
  let snapshot: Win32HelperSessionSnapshot = {
    helperState: 'idle',
    helperLastErrorCode: null,
    helperPid: null
  };

  async function ensureReady(timeoutMs: number): Promise<void> {
    if (activeSession && snapshot.helperState === 'ready') {
      return;
    }

    if (startingPromise) {
      return startingPromise;
    }

    startingPromise = startSession(timeoutMs).finally(() => {
      startingPromise = null;
    });

    return startingPromise;
  }

  async function startSession(timeoutMs: number): Promise<void> {
    await disposeSession(false);

    const launchCommand = resolveWin32HelperLaunch({
      isPackaged,
      resourcesPath
    });
    const helperProcess = spawnHelperProcess(launchCommand);

    snapshot = {
      helperState: 'starting',
      helperLastErrorCode: null,
      helperPid: helperProcess.pid ?? null
    };

    const client = createStdIoClient({
      transport: helperProcess.transport,
      onStderr(chunk) {
        void logger.warn(`win32-helper stderr: ${chunk.trim()}`);
      },
      onExit(error) {
        snapshot = {
          helperState: 'stopped',
          helperLastErrorCode: 'PLATFORM_BRIDGE_UNAVAILABLE',
          helperPid: null
        };
        activeSession = null;
        void logger.error(
          error?.message ?? 'The win32 helper process exited unexpectedly.'
        );
      }
    });

    activeSession = {
      client,
      process: helperProcess
    };

    try {
      const response = await client.send(
        toHelperRequest('health-check', {}),
        {
          timeoutMs
        }
      );

      if (!response.ok) {
        throw createBridgeError(
          response.error?.code ?? 'PLATFORM_BRIDGE_UNAVAILABLE',
          response.error?.message ??
            'The win32 helper health-check returned an error.'
        );
      }

      snapshot = {
        helperState: 'ready',
        helperLastErrorCode: null,
        helperPid: helperProcess.pid ?? null
      };
      void logger.debug('win32 helper session is ready');
    } catch (error) {
      const bridgeError = normalizeBridgeError(error);

      snapshot = {
        helperState:
          bridgeError.code === 'PLATFORM_BRIDGE_TIMEOUT'
            ? 'degraded'
            : 'stopped',
        helperLastErrorCode: bridgeError.code,
        helperPid:
          bridgeError.code === 'PLATFORM_BRIDGE_TIMEOUT'
            ? helperProcess.pid ?? null
            : null
      };

      if (bridgeError.code !== 'PLATFORM_BRIDGE_TIMEOUT') {
        await disposeSession(false);
      }

      throw bridgeError;
    }
  }

  async function disposeSession(markStopped = true): Promise<void> {
    if (!activeSession) {
      if (markStopped) {
        snapshot = {
          helperState: 'stopped',
          helperLastErrorCode: snapshot.helperLastErrorCode,
          helperPid: null
        };
      }

      return;
    }

    activeSession.client.dispose();
    await Promise.resolve(activeSession.process.dispose());
    activeSession = null;

    if (markStopped) {
      snapshot = {
        helperState: 'stopped',
        helperLastErrorCode: snapshot.helperLastErrorCode,
        helperPid: null
      };
    }
  }

  return {
    async send(
      kind: HelperRequestKind,
      payload: Record<string, unknown>,
      options: Win32HelperSessionSendOptions = {}
    ): Promise<HelperResponse> {
      const timeoutMs = options.timeoutMs ?? requestTimeoutMs;
      const request = toHelperRequest(kind, payload);

      await ensureReady(timeoutMs);

      if (!activeSession) {
        throw createBridgeError(
          'PLATFORM_BRIDGE_UNAVAILABLE',
          'The win32 helper session is unavailable.'
        );
      }

      try {
        const response = await activeSession.client.send(request, {
          timeoutMs
        });

        snapshot = {
          ...snapshot,
          helperLastErrorCode: response.ok ? null : response.error?.code ?? null
        };

        logHelperResponse(logger, request, response);
        return response;
      } catch (error) {
        const bridgeError = normalizeBridgeError(error);

        if (bridgeError.code === 'PLATFORM_BRIDGE_TIMEOUT') {
          snapshot = {
            helperState: 'degraded',
            helperLastErrorCode: bridgeError.code,
            helperPid: snapshot.helperPid
          };
        } else {
          snapshot = {
            helperState: 'stopped',
            helperLastErrorCode: bridgeError.code,
            helperPid: null
          };
          await disposeSession(false);
        }

        logHelperTransportError(logger, request, bridgeError);
        throw bridgeError;
      }
    },
    getSnapshot(): Win32HelperSessionSnapshot {
      return { ...snapshot };
    },
    async dispose(): Promise<void> {
      await disposeSession(true);
    }
  };
}

function defaultSpawnWin32HelperProcess(
  command: Win32HelperLaunchCommand
): SpawnedWin32HelperProcess {
  const childProcess = spawn(command.command, command.args, {
    stdio: 'pipe',
    windowsHide: true
  });

  childProcess.stdout?.setEncoding('utf8');
  childProcess.stderr?.setEncoding('utf8');

  return {
    pid: childProcess.pid ?? null,
    transport: {
      write(chunk: string) {
        childProcess.stdin?.write(chunk, 'utf8');
      },
      onStdout(listener) {
        const handleData = (chunk: string | Buffer) => {
          listener(chunk.toString());
        };

        childProcess.stdout?.on('data', handleData);
        return () => childProcess.stdout?.off('data', handleData);
      },
      onStderr(listener) {
        const handleData = (chunk: string | Buffer) => {
          listener(chunk.toString());
        };

        childProcess.stderr?.on('data', handleData);
        return () => childProcess.stderr?.off('data', handleData);
      },
      onExit(listener) {
        const handleExit = () => listener();
        const handleError = (error: Error) => listener(error);

        childProcess.on('exit', handleExit);
        childProcess.on('error', handleError);

        return () => {
          childProcess.off('exit', handleExit);
          childProcess.off('error', handleError);
        };
      }
    },
    dispose() {
      if (!childProcess.killed) {
        childProcess.kill();
      }
    }
  };
}

function createBridgeError(code: string, message: string): StdIoJsonClientError {
  return new StdIoJsonClientError(code, message);
}

function normalizeBridgeError(error: unknown): StdIoJsonClientError {
  if (
    error instanceof Error &&
    typeof (error as Partial<StdIoJsonClientError>).code === 'string'
  ) {
    return error as StdIoJsonClientError;
  }

  return createBridgeError(
    'PLATFORM_BRIDGE_UNAVAILABLE',
    error instanceof Error
      ? error.message
      : 'The win32 helper session is unavailable.'
  );
}

function logHelperResponse(
  logger: SessionLogger,
  request: HelperRequest<Record<string, unknown>>,
  response: HelperResponse
): void {
  const requestSummary = summarizeHelperRequest(request.kind, request.payload);
  const responseSummary = summarizeHelperResponse(response.kind, response.payload);
  const details = [requestSummary, responseSummary].filter(Boolean).join('; ');

  if (response.ok) {
    void logger.debug(
      details.length > 0
        ? `win32-helper ${response.kind} succeeded; ${details}`
        : `win32-helper ${response.kind} succeeded`
    );
    return;
  }

  const errorCode = response.error?.code ?? 'UNKNOWN_HELPER_ERROR';
  const errorMessage = response.error?.message ?? 'The helper returned an unspecified error.';

  void logger.warn(
    details.length > 0
      ? `win32-helper ${response.kind} failed (${errorCode}): ${errorMessage}; ${details}`
      : `win32-helper ${response.kind} failed (${errorCode}): ${errorMessage}`
  );
}

function logHelperTransportError(
  logger: SessionLogger,
  request: HelperRequest<Record<string, unknown>>,
  error: StdIoJsonClientError
): void {
  const requestSummary = summarizeHelperRequest(request.kind, request.payload);

  void logger.error(
    requestSummary.length > 0
      ? `win32-helper ${request.kind} transport failed (${error.code}): ${error.message}; ${requestSummary}`
      : `win32-helper ${request.kind} transport failed (${error.code}): ${error.message}`
  );
}

function summarizeHelperRequest(
  kind: HelperRequestKind,
  payload: Record<string, unknown>
): string {
  if (kind === 'capture-text') {
    const method = getString(payload, 'method');
    return method ? `request method=${method}` : '';
  }

  if (kind === 'write-text') {
    const parts = [
      formatSummaryPart('request method', getString(payload, 'method')),
      formatSummaryPart('textLength', getString(payload, 'text')?.length),
      formatSummaryPart(
        'expectedSourceTextLength',
        getString(payload, 'expectedSourceText')?.length
      )
    ].filter(Boolean);

    return parts.join(' ');
  }

  if (kind === 'clipboard-write') {
    const textLength = getString(payload, 'text')?.length;
    return typeof textLength === 'number' ? `request textLength=${textLength}` : '';
  }

  return '';
}

function summarizeHelperResponse(
  kind: HelperRequestKind,
  payload: unknown
): string {
  if (!isRecord(payload)) {
    return '';
  }

  const diagnostics = getRecord(payload, 'diagnostics');

  if (kind === 'capture-text') {
    const parts = [
      formatSummaryPart('response method', getString(payload, 'method')),
      formatSummaryPart('textLength', getString(payload, 'text')?.length),
      formatSummaryPart('processName', getString(diagnostics, 'processName')),
      formatSummaryPart('windowClassName', getString(diagnostics, 'windowClassName')),
      formatSummaryPart('windowTitle', summarizeText(getString(diagnostics, 'windowTitle'))),
      formatSummaryPart('controlType', getString(diagnostics, 'controlType')),
      formatSummaryPart('framework', getString(diagnostics, 'framework')),
      formatSummaryPart('apiAttempted', getString(diagnostics, 'apiAttempted')),
      formatSummaryPart('selectionDetected', getBoolean(diagnostics, 'selectionDetected')),
      formatSummaryPart('editable', getBoolean(diagnostics, 'editable')),
      formatSummaryPart(
        'transientShellWindowDetected',
        getBoolean(diagnostics, 'transientShellWindowDetected')
      ),
      formatSummaryPart(
        'focusStabilizationReason',
        getString(diagnostics, 'focusStabilizationReason')
      ),
      formatSummaryPart(
        'focusStabilizationWaitMs',
        getNumber(diagnostics, 'focusStabilizationWaitMs')
      ),
      formatSummaryPart(
        'focusStabilizationTimedOut',
        getBoolean(diagnostics, 'focusStabilizationTimedOut')
      ),
      formatSummaryPart('hadPressedModifiers', getBoolean(diagnostics, 'hadPressedModifiers')),
      formatSummaryPart(
        'modifierReleaseWaitMs',
        getNumber(diagnostics, 'modifierReleaseWaitMs')
      ),
      formatSummaryPart(
        'modifierReleaseTimedOut',
        getBoolean(diagnostics, 'modifierReleaseTimedOut')
      )
    ].filter(Boolean);

    return parts.join(' ');
  }

  if (kind === 'write-text' || kind === 'clipboard-write') {
    const parts = [
      formatSummaryPart('response method', getString(payload, 'method')),
      formatSummaryPart('processName', getString(diagnostics, 'processName')),
      formatSummaryPart('windowClassName', getString(diagnostics, 'windowClassName')),
      formatSummaryPart('windowTitle', summarizeText(getString(diagnostics, 'windowTitle'))),
      formatSummaryPart('controlType', getString(diagnostics, 'controlType')),
      formatSummaryPart('framework', getString(diagnostics, 'framework')),
      formatSummaryPart(
        'selectionMatchedExpected',
        getBoolean(diagnostics, 'selectionMatchedExpected')
      ),
      formatSummaryPart('targetStable', getBoolean(diagnostics, 'targetStable')),
      formatSummaryPart('valueChanged', getBoolean(diagnostics, 'valueChanged')),
      formatSummaryPart(
        'translatedTextDetected',
        getBoolean(diagnostics, 'translatedTextDetected')
      ),
      formatSummaryPart(
        'verificationTimedOut',
        getBoolean(diagnostics, 'verificationTimedOut')
      ),
      formatSummaryPart(
        'verificationMethod',
        getString(diagnostics, 'verificationMethod')
      ),
      formatSummaryPart('hadPressedModifiers', getBoolean(diagnostics, 'hadPressedModifiers')),
      formatSummaryPart(
        'modifierReleaseWaitMs',
        getNumber(diagnostics, 'modifierReleaseWaitMs')
      ),
      formatSummaryPart(
        'modifierReleaseTimedOut',
        getBoolean(diagnostics, 'modifierReleaseTimedOut')
      )
    ].filter(Boolean);

    return parts.join(' ');
  }

  return '';
}

function formatSummaryPart(
  label: string,
  value: boolean | number | string | undefined
): string {
  return value === undefined ? '' : `${label}=${value}`;
}

function getString(
  record: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  if (!record) {
    return undefined;
  }

  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumber(
  record: Record<string, unknown> | undefined,
  key: string
): number | undefined {
  if (!record) {
    return undefined;
  }

  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function getBoolean(
  record: Record<string, unknown> | undefined,
  key: string
): boolean | undefined {
  if (!record) {
    return undefined;
  }

  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getRecord(
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function summarizeText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized.length <= 60
    ? normalized
    : `${normalized.slice(0, 57)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
