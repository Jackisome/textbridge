import type { Win32Request, Win32Response } from './protocol';

export interface Win32ProcessTransport {
  send(request: Win32Request): Promise<Win32Response>;
}

export interface Win32ProcessClient {
  send(request: Win32Request): Promise<Win32Response>;
}

export interface CreateWin32ProcessClientOptions {
  transport?: Win32ProcessTransport;
}

export function createWin32ProcessClient({
  transport
}: CreateWin32ProcessClientOptions = {}): Win32ProcessClient {
  return {
    async send(request: Win32Request): Promise<Win32Response> {
      if (transport) {
        return transport.send(request);
      }

      if (request.kind === 'capture-text') {
        return {
          kind: 'capture-text',
          ok: false,
          method: request.method,
          error: {
            code: 'WIN32_HELPER_UNAVAILABLE',
            message: 'The Windows helper process is not connected.'
          }
        };
      }

      if (request.kind === 'capture-selection-context') {
        return {
          kind: 'capture-selection-context',
          ok: false,
          method: request.method,
          error: {
            code: 'WIN32_HELPER_UNAVAILABLE',
            message: 'The Windows helper process is not connected.'
          }
        };
      }

      if (request.kind === 'restore-target') {
        return {
          kind: 'restore-target',
          ok: false,
          restored: false,
          error: {
            code: 'WIN32_HELPER_UNAVAILABLE',
            message: 'The Windows helper process is not connected.'
          }
        };
      }

      return {
        kind: 'write-text',
        ok: false,
        method: request.method,
        error: {
          code: 'WIN32_HELPER_UNAVAILABLE',
          message: 'The Windows helper process is not connected.'
        }
      };
    }
  };
}
