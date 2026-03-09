import { describe, expect, it, vi } from 'vitest';
import { toHelperRequest } from './helper-protocol';
import {
  StdIoJsonClientError,
  createStdIoJsonClient,
  type StdIoJsonTransport
} from './stdio-json-client';

function createFakeTransport() {
  const stdoutListeners = new Set<(chunk: string) => void>();
  const stderrListeners = new Set<(chunk: string) => void>();
  const exitListeners = new Set<(error?: Error) => void>();
  const writes: string[] = [];

  const transport: StdIoJsonTransport = {
    async write(chunk: string) {
      writes.push(chunk);
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
  };

  return {
    transport,
    writes,
    emitStdout(chunk: string) {
      for (const listener of stdoutListeners) {
        listener(chunk);
      }
    },
    emitStderr(chunk: string) {
      for (const listener of stderrListeners) {
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

describe('createStdIoJsonClient', () => {
  it('matches helper responses by id and resolves the pending request', async () => {
    const fakeTransport = createFakeTransport();
    const client = createStdIoJsonClient({
      transport: fakeTransport.transport
    });
    const request = toHelperRequest('health-check', {});
    const promise = client.send(request, {
      timeoutMs: 100
    });

    fakeTransport.emitStdout(
      `{"id":"${request.id}","kind":"health-check","ok":true,`
    );
    fakeTransport.emitStdout('"payload":{},"error":null}\n');

    await expect(promise).resolves.toMatchObject({
      id: request.id,
      kind: 'health-check',
      ok: true
    });
    expect(fakeTransport.writes).toHaveLength(1);
    expect(fakeTransport.writes[0]).toBe(`${JSON.stringify(request)}\n`);
  });

  it('forwards stderr output to the provided callback', async () => {
    const fakeTransport = createFakeTransport();
    const onStderr = vi.fn();
    const client = createStdIoJsonClient({
      transport: fakeTransport.transport,
      onStderr
    });

    fakeTransport.emitStderr('helper stderr line');
    client.dispose();

    expect(onStderr).toHaveBeenCalledWith('helper stderr line');
  });

  it('rejects the pending request with a timeout error when no response arrives', async () => {
    vi.useFakeTimers();

    try {
      const fakeTransport = createFakeTransport();
      const client = createStdIoJsonClient({
        transport: fakeTransport.transport
      });
      const request = toHelperRequest('health-check', {});
      const promise = client.send(request, {
        timeoutMs: 50
      });
      const rejection = expect(promise).rejects.toMatchObject<
        Partial<StdIoJsonClientError>
      >({
        code: 'PLATFORM_BRIDGE_TIMEOUT'
      });

      await vi.advanceTimersByTimeAsync(51);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});
