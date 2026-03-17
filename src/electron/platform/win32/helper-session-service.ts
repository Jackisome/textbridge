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

      await ensureReady(timeoutMs);

      if (!activeSession) {
        throw createBridgeError(
          'PLATFORM_BRIDGE_UNAVAILABLE',
          'The win32 helper session is unavailable.'
        );
      }

      try {
        const response = await activeSession.client.send(
          toHelperRequest(kind, payload),
          {
            timeoutMs
          }
        );

        if (!response.ok) {
          snapshot = {
            ...snapshot,
            helperLastErrorCode: response.error?.code ?? null
          };
        }

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
