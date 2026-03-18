import type { TextCaptureResult } from '../../../core/entities/text-capture';
import type { WriteBackResult } from '../../../core/entities/write-back';
import type { HelperResponse } from '../common/helper-protocol';
import type { Win32HelperSessionService } from './helper-session-service';
import {
  createWin32ProcessClient,
  type CreateWin32ProcessClientOptions,
  type Win32ProcessClient
} from './process-client';
import type { Win32CaptureMethod, Win32WriteMethod } from './protocol';

export interface Win32Adapter {
  captureText(method: Win32CaptureMethod): Promise<TextCaptureResult>;
  writeText(
    text: string,
    method: Win32WriteMethod,
    expectedSourceText?: string
  ): Promise<WriteBackResult>;
  copyToClipboard(text: string): Promise<void>;
}

export interface CreateWin32AdapterOptions {
  helperSession?: Pick<Win32HelperSessionService, 'send'>;
  client?: Win32ProcessClient;
  processClientOptions?: CreateWin32ProcessClientOptions;
}

export function createWin32Adapter({
  helperSession,
  client,
  processClientOptions
}: CreateWin32AdapterOptions = {}): Win32Adapter {
  const processClient = helperSession
    ? null
    : client ?? createWin32ProcessClient(processClientOptions);

  return {
    async captureText(method: Win32CaptureMethod): Promise<TextCaptureResult> {
      if (helperSession) {
        const response = await helperSession.send('capture-text', {
          method
        });

        if (response.kind !== 'capture-text') {
          throw new Error(
            'Received an unexpected helper response kind for capture-text.'
          );
        }

        return mapCaptureResponse(response, method);
      }

      if (!processClient) {
        throw new Error(
          'Win32 adapter is missing both helperSession and processClient.'
        );
      }

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

    async writeText(
      text: string,
      method: Win32WriteMethod,
      expectedSourceText?: string
    ): Promise<WriteBackResult> {
      if (helperSession) {
        const response = await helperSession.send('write-text', {
          method,
          text,
          ...(expectedSourceText
            ? { expectedSourceText }
            : {})
        });

        if (response.kind !== 'write-text') {
          throw new Error(
            'Received an unexpected helper response kind for write-text.'
          );
        }

        return mapWriteResponse(response, method);
      }

      if (!processClient) {
        throw new Error(
          'Win32 adapter is missing both helperSession and processClient.'
        );
      }

      const response = await processClient.send({
        kind: 'write-text',
        method,
        text,
        ...(expectedSourceText
          ? { expectedSourceText }
          : {})
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
    },

    async copyToClipboard(text: string): Promise<void> {
      if (helperSession) {
        const response = await helperSession.send('clipboard-write', {
          text
        });

        if (response.kind !== 'clipboard-write') {
          throw new Error(
            'Received an unexpected helper response kind for clipboard-write.'
          );
        }

        if (!response.ok) {
          throw new Error(
            response.error?.message ??
              'The helper failed to update the system clipboard.'
          );
        }

        return;
      }

      throw new Error('The Windows helper process is not connected.');
    }
  };
}

function mapCaptureResponse(
  response: HelperResponse,
  fallbackMethod: Win32CaptureMethod
): TextCaptureResult {
  const payload = asPayload(response.payload);
  const method = toCaptureMethod(payload.method, fallbackMethod);

  return response.ok
    ? {
        success: true,
        method,
        text: typeof payload.text === 'string' ? payload.text : ''
      }
    : {
        success: false,
        method,
        errorCode: response.error?.code,
        errorMessage: response.error?.message
      };
}

function mapWriteResponse(
  response: HelperResponse,
  fallbackMethod: Win32WriteMethod
): WriteBackResult {
  const payload = asPayload(response.payload);
  const method = toWriteMethod(payload.method, fallbackMethod);

  return response.ok
    ? {
        success: true,
        method
      }
    : {
        success: false,
        method,
        errorCode: response.error?.code,
        errorMessage: response.error?.message
      };
}

function asPayload(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function toCaptureMethod(
  value: unknown,
  fallbackMethod: Win32CaptureMethod
): Win32CaptureMethod {
  return value === 'uia' || value === 'clipboard' ? value : fallbackMethod;
}

function toWriteMethod(
  value: unknown,
  fallbackMethod: Win32WriteMethod
): Win32WriteMethod {
  return value === 'replace-selection' || value === 'paste-translation'
    ? value
    : fallbackMethod;
}
