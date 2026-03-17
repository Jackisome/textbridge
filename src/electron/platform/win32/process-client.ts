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

      return request.kind === 'capture-text'
        ? {
            kind: 'capture-text',
            ok: false,
            method: request.method,
            error: {
              code: 'WIN32_HELPER_UNAVAILABLE',
              message: 'The Windows helper process is not connected.'
            }
          }
        : {
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
