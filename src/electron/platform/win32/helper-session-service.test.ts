import { describe, expect, it, vi } from 'vitest';
import type { HelperRequest } from '../common/helper-protocol';
import {
  createWin32HelperSessionService,
  type SpawnedWin32HelperProcess,
  type SpawnWin32HelperProcess,
  type Win32HelperSessionSnapshot
} from './helper-session-service';

function createFakeSpawnedProcess() {
  const stdoutListeners = new Set<(chunk: string) => void>();
  const stderrListeners = new Set<(chunk: string) => void>();
  const exitListeners = new Set<(error?: Error) => void>();
  const writtenRequests: HelperRequest[] = [];

  const process: SpawnedWin32HelperProcess = {
    pid: 4321,
    transport: {
      async write(chunk: string) {
        const request = JSON.parse(chunk.trim()) as HelperRequest;
        writtenRequests.push(request);
      },
      onStdout(listener) {
        stdoutListeners.add(listener);
        return () => stdoutListeners.delete(listener);
      },
      onStderr(listener) {
        stderrListeners.add(listener);
        return () => stderrListeners.delete(listener);
      },
      onExit(listener) {
        exitListeners.add(listener);
        return () => exitListeners.delete(listener);
      }
    },
    dispose: vi.fn()
  };

  return {
    process,
    writtenRequests,
    respondWith(payload: object) {
      const chunk = `${JSON.stringify(payload)}\n`;

      for (const listener of stdoutListeners) {
        listener(chunk);
      }
    },
    emitExit(error?: Error) {
      for (const listener of exitListeners) {
        listener(error);
      }
    }
  };
}

describe('createWin32HelperSessionService', () => {
  it('lazily starts the helper, performs a health-check, and keeps a ready snapshot', async () => {
    const fakeProcess = createFakeSpawnedProcess();
    const spawnHelperProcess: SpawnWin32HelperProcess = vi.fn(() => fakeProcess.process);
    const session = createWin32HelperSessionService({
      isPackaged: false,
      requestTimeoutMs: 100,
      spawnHelperProcess
    });

    const sendPromise = session.send('capture-text', {
      method: 'uia'
    });
    await Promise.resolve();

    expect(spawnHelperProcess).toHaveBeenCalledTimes(1);
    expect(fakeProcess.writtenRequests[0]?.kind).toBe('health-check');

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[0]?.id,
      kind: 'health-check',
      ok: true,
      payload: {},
      error: null
    });

    await vi.waitFor(() => {
      expect(fakeProcess.writtenRequests[1]?.kind).toBe('capture-text');
    });

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[1]?.id,
      kind: 'capture-text',
      ok: true,
      payload: {
        text: 'Hello from helper'
      },
      error: null
    });

    await expect(sendPromise).resolves.toMatchObject({
      kind: 'capture-text',
      ok: true
    });
    expect(session.getSnapshot()).toMatchObject<Partial<Win32HelperSessionSnapshot>>({
      helperState: 'ready',
      helperPid: 4321,
      helperLastErrorCode: null
    });
  });

  it('marks the helper session as degraded after request timeout', async () => {
    vi.useFakeTimers();

    try {
      const fakeProcess = createFakeSpawnedProcess();
      const session = createWin32HelperSessionService({
        isPackaged: false,
        requestTimeoutMs: 50,
        spawnHelperProcess: () => fakeProcess.process
      });

      const sendPromise = session.send('write-text', {
        method: 'replace-selection',
        text: 'translated'
      });
      const rejection = expect(sendPromise).rejects.toMatchObject({
        code: 'PLATFORM_BRIDGE_TIMEOUT'
      });

      fakeProcess.respondWith({
        id: fakeProcess.writtenRequests[0]?.id,
        kind: 'health-check',
        ok: true,
        payload: {},
        error: null
      });

      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(51);

      await rejection;
      expect(session.getSnapshot()).toMatchObject<Partial<Win32HelperSessionSnapshot>>({
        helperState: 'degraded',
        helperLastErrorCode: 'PLATFORM_BRIDGE_TIMEOUT',
        helperPid: 4321
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks the helper as stopped when the process exits', async () => {
    const fakeProcess = createFakeSpawnedProcess();
    const session = createWin32HelperSessionService({
      isPackaged: false,
      requestTimeoutMs: 100,
      spawnHelperProcess: () => fakeProcess.process
    });

    const sendPromise = session.send('capture-text', {
      method: 'uia'
    });

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[0]?.id,
      kind: 'health-check',
      ok: true,
      payload: {},
      error: null
    });

    await Promise.resolve();
    fakeProcess.emitExit(new Error('helper exited'));

    await expect(sendPromise).rejects.toMatchObject({
      code: 'PLATFORM_BRIDGE_UNAVAILABLE'
    });
    expect(session.getSnapshot()).toMatchObject<Partial<Win32HelperSessionSnapshot>>({
      helperState: 'stopped',
      helperLastErrorCode: 'PLATFORM_BRIDGE_UNAVAILABLE',
      helperPid: null
    });
  });
});
