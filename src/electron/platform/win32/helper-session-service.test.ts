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

  it('logs helper response errors with request context and updates the snapshot', async () => {
    const fakeProcess = createFakeSpawnedProcess();
    const logger = {
      debug: vi.fn().mockResolvedValue(undefined),
      warn: vi.fn().mockResolvedValue(undefined),
      error: vi.fn().mockResolvedValue(undefined)
    };
    const session = createWin32HelperSessionService({
      isPackaged: false,
      requestTimeoutMs: 100,
      spawnHelperProcess: () => fakeProcess.process,
      logger
    });

    const sendPromise = session.send('write-text', {
      method: 'replace-selection',
      text: 'translated'
    });
    await Promise.resolve();

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[0]?.id,
      kind: 'health-check',
      ok: true,
      payload: {},
      error: null
    });

    await vi.waitFor(() => {
      expect(fakeProcess.writtenRequests[1]?.kind).toBe('write-text');
    });

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[1]?.id,
      kind: 'write-text',
      ok: false,
      payload: {
        method: 'replace-selection'
      },
      error: {
        code: 'WRITE_BACK_UNSUPPORTED',
        message: 'Safe selection replacement is not implemented.'
      }
    });

    await expect(sendPromise).resolves.toMatchObject({
      kind: 'write-text',
      ok: false,
      error: {
        code: 'WRITE_BACK_UNSUPPORTED'
      }
    });
    expect(session.getSnapshot()).toMatchObject<Partial<Win32HelperSessionSnapshot>>({
      helperState: 'ready',
      helperLastErrorCode: 'WRITE_BACK_UNSUPPORTED',
      helperPid: 4321
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'win32-helper write-text failed (WRITE_BACK_UNSUPPORTED): Safe selection replacement is not implemented.; request method=replace-selection textLength=10; response method=replace-selection'
    );
  });

  it('clears helperLastErrorCode after a later successful helper response', async () => {
    const fakeProcess = createFakeSpawnedProcess();
    const session = createWin32HelperSessionService({
      isPackaged: false,
      requestTimeoutMs: 100,
      spawnHelperProcess: () => fakeProcess.process
    });

    const firstSendPromise = session.send('write-text', {
      method: 'replace-selection',
      text: 'translated'
    });
    await Promise.resolve();

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[0]?.id,
      kind: 'health-check',
      ok: true,
      payload: {},
      error: null
    });

    await vi.waitFor(() => {
      expect(fakeProcess.writtenRequests[1]?.kind).toBe('write-text');
    });

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[1]?.id,
      kind: 'write-text',
      ok: false,
      payload: {
        method: 'replace-selection'
      },
      error: {
        code: 'WRITE_BACK_UNSUPPORTED',
        message: 'Safe selection replacement is not implemented.'
      }
    });

    await firstSendPromise;
    expect(session.getSnapshot()).toMatchObject<Partial<Win32HelperSessionSnapshot>>({
      helperLastErrorCode: 'WRITE_BACK_UNSUPPORTED'
    });

    const secondSendPromise = session.send('capture-text', {
      method: 'uia'
    });

    await vi.waitFor(() => {
      expect(fakeProcess.writtenRequests[2]?.kind).toBe('capture-text');
    });

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[2]?.id,
      kind: 'capture-text',
      ok: true,
      payload: {
        method: 'uia',
        text: 'world'
      },
      error: null
    });

    await expect(secondSendPromise).resolves.toMatchObject({
      kind: 'capture-text',
      ok: true
    });
    expect(session.getSnapshot()).toMatchObject<Partial<Win32HelperSessionSnapshot>>({
      helperState: 'ready',
      helperLastErrorCode: null,
      helperPid: 4321
    });
  });

  it('logs selection-context and restore-target diagnostics with anchor and restore details', async () => {
    const fakeProcess = createFakeSpawnedProcess();
    const logger = {
      debug: vi.fn().mockResolvedValue(undefined),
      warn: vi.fn().mockResolvedValue(undefined),
      error: vi.fn().mockResolvedValue(undefined)
    };
    const session = createWin32HelperSessionService({
      isPackaged: false,
      requestTimeoutMs: 100,
      spawnHelperProcess: () => fakeProcess.process,
      logger
    });

    const capturePromise = session.send('capture-selection-context', {
      method: 'uia'
    });
    await Promise.resolve();

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[0]?.id,
      kind: 'health-check',
      ok: true,
      payload: {},
      error: null
    });

    await vi.waitFor(() => {
      expect(fakeProcess.writtenRequests[1]?.kind).toBe(
        'capture-selection-context'
      );
    });

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[1]?.id,
      kind: 'capture-selection-context',
      ok: true,
      payload: {
        method: 'uia',
        text: 'world',
        anchor: {
          kind: 'selection-rect',
          bounds: {
            x: 10,
            y: 10,
            width: 40,
            height: 20
          }
        },
        restoreTarget: {
          token: 'hwnd:123'
        },
        capabilities: {
          canPositionPromptNearSelection: true,
          canRestoreTargetAfterPrompt: true,
          canAutoWriteBackAfterPrompt: true
        },
        diagnostics: {
          processName: 'notepad',
          windowClassName: 'Edit'
        }
      },
      error: null
    });

    await expect(capturePromise).resolves.toMatchObject({
      kind: 'capture-selection-context',
      ok: true
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'win32-helper capture-selection-context succeeded; request method=uia; response method=uia textLength=5 anchorKind=selection-rect anchorBounds=10,10,40,20 restoreToken=hwnd:123 canPositionPromptNearSelection=true canRestoreTargetAfterPrompt=true canAutoWriteBackAfterPrompt=true processName=notepad windowClassName=Edit'
    );

    const restorePromise = session.send('restore-target', {
      token: 'hwnd:123'
    });

    await vi.waitFor(() => {
      expect(fakeProcess.writtenRequests[2]?.kind).toBe('restore-target');
    });

    fakeProcess.respondWith({
      id: fakeProcess.writtenRequests[2]?.id,
      kind: 'restore-target',
      ok: true,
      payload: {
        restored: true,
        diagnostics: {
          requestedToken: 'hwnd:123',
          windowHandle: 123,
          foregroundRestored: true
        }
      },
      error: null
    });

    await expect(restorePromise).resolves.toMatchObject({
      kind: 'restore-target',
      ok: true
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'win32-helper restore-target succeeded; request token=hwnd:123; restored=true requestedToken=hwnd:123 windowHandle=123 foregroundRestored=true'
    );
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
