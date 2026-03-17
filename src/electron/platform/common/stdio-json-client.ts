import {
  isHelperResponse,
  type HelperRequest,
  type HelperResponse
} from './helper-protocol';

export interface StdIoJsonTransport {
  write(chunk: string): Promise<void> | void;
  onStdout(listener: (chunk: string) => void): () => void;
  onStderr?(listener: (chunk: string) => void): () => void;
  onExit?(listener: (error?: Error) => void): () => void;
}

export interface StdIoJsonClientSendOptions {
  timeoutMs?: number;
}

export interface StdIoJsonClient {
  send(
    request: HelperRequest,
    options?: StdIoJsonClientSendOptions
  ): Promise<HelperResponse>;
  dispose(): void;
}

export interface CreateStdIoJsonClientOptions {
  transport: StdIoJsonTransport;
  onStderr?: (chunk: string) => void | Promise<void>;
  onExit?: (error?: Error) => void | Promise<void>;
}

interface PendingRequest {
  reject: (error: StdIoJsonClientError) => void;
  resolve: (response: HelperResponse) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class StdIoJsonClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'StdIoJsonClientError';
    this.code = code;
  }
}

export function createStdIoJsonClient({
  transport,
  onStderr,
  onExit
}: CreateStdIoJsonClientOptions): StdIoJsonClient {
  const pendingRequests = new Map<string, PendingRequest>();
  const unsubscribeStdout = transport.onStdout(handleStdoutChunk);
  const unsubscribeStderr = transport.onStderr?.((chunk) => {
    void Promise.resolve(onStderr?.(chunk));
  });
  const unsubscribeExit = transport.onExit?.((error) => {
    rejectPendingRequests(
      new StdIoJsonClientError(
        'PLATFORM_BRIDGE_UNAVAILABLE',
        error?.message ?? 'The win32 helper process exited unexpectedly.'
      )
    );
    void Promise.resolve(onExit?.(error));
  });
  let disposed = false;
  let stdoutBuffer = '';

  function handleStdoutChunk(chunk: string): void {
    stdoutBuffer += chunk;

    while (true) {
      const newlineIndex = stdoutBuffer.indexOf('\n');

      if (newlineIndex < 0) {
        return;
      }

      const rawLine = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

      if (rawLine.length === 0) {
        continue;
      }

      try {
        const candidate = JSON.parse(rawLine) as unknown;

        if (!isHelperResponse(candidate)) {
          continue;
        }

        const pendingRequest = pendingRequests.get(candidate.id);

        if (!pendingRequest) {
          continue;
        }

        clearTimeout(pendingRequest.timeout);
        pendingRequests.delete(candidate.id);
        pendingRequest.resolve(candidate);
      } catch {
        // Ignore malformed lines and keep waiting for a valid NDJSON response.
      }
    }
  }

  function rejectPendingRequests(error: StdIoJsonClientError): void {
    for (const pendingRequest of pendingRequests.values()) {
      clearTimeout(pendingRequest.timeout);
      pendingRequest.reject(error);
    }

    pendingRequests.clear();
  }

  return {
    async send(
      request: HelperRequest,
      options: StdIoJsonClientSendOptions = {}
    ): Promise<HelperResponse> {
      if (disposed) {
        throw new StdIoJsonClientError(
          'PLATFORM_BRIDGE_UNAVAILABLE',
          'The stdio client has already been disposed.'
        );
      }

      return new Promise<HelperResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(request.id);
          reject(
            new StdIoJsonClientError(
              'PLATFORM_BRIDGE_TIMEOUT',
              `Timed out while waiting for helper response: ${request.kind}`
            )
          );
        }, options.timeoutMs ?? 5_000);

        pendingRequests.set(request.id, {
          resolve,
          reject,
          timeout
        });

        void Promise.resolve(transport.write(`${JSON.stringify(request)}\n`)).catch(
          (error: unknown) => {
            clearTimeout(timeout);
            pendingRequests.delete(request.id);
            reject(
              new StdIoJsonClientError(
                'PLATFORM_BRIDGE_UNAVAILABLE',
                error instanceof Error
                  ? error.message
                  : 'Failed to write request to the helper transport.'
              )
            );
          }
        );
      });
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      unsubscribeStdout();
      unsubscribeStderr?.();
      unsubscribeExit?.();
      rejectPendingRequests(
        new StdIoJsonClientError(
          'PLATFORM_BRIDGE_UNAVAILABLE',
          'The stdio client has been disposed.'
        )
      );
    }
  };
}
