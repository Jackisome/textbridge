import type { TextCaptureResult } from '../../../core/entities/text-capture';
import type { WriteBackResult } from '../../../core/entities/write-back';
import {
  createWin32ProcessClient,
  type CreateWin32ProcessClientOptions,
  type Win32ProcessClient
} from './process-client';
import type { Win32CaptureMethod, Win32WriteMethod } from './protocol';

export interface Win32Adapter {
  captureText(method: Win32CaptureMethod): Promise<TextCaptureResult>;
  writeText(text: string, method: Win32WriteMethod): Promise<WriteBackResult>;
}

export interface CreateWin32AdapterOptions {
  client?: Win32ProcessClient;
  processClientOptions?: CreateWin32ProcessClientOptions;
}

export function createWin32Adapter({
  client,
  processClientOptions
}: CreateWin32AdapterOptions = {}): Win32Adapter {
  const processClient = client ?? createWin32ProcessClient(processClientOptions);

  return {
    async captureText(method: Win32CaptureMethod): Promise<TextCaptureResult> {
      const response = await processClient.send({
        kind: 'capture-text',
        method
      });

      if (response.kind !== 'capture-text') {
        throw new Error('Received an unexpected response kind for capture-text.');
      }

      return response.ok
        ? {
            success: true,
            method: response.method,
            text: response.text ?? ''
          }
        : {
            success: false,
            method: response.method,
            errorCode: response.error?.code,
            errorMessage: response.error?.message
          };
    },
    async writeText(text: string, method: Win32WriteMethod): Promise<WriteBackResult> {
      const response = await processClient.send({
        kind: 'write-text',
        method,
        text
      });

      if (response.kind !== 'write-text') {
        throw new Error('Received an unexpected response kind for write-text.');
      }

      return response.ok
        ? {
            success: true,
            method: response.method
          }
        : {
            success: false,
            method: response.method,
            errorCode: response.error?.code,
            errorMessage: response.error?.message
          };
    }
  };
}
