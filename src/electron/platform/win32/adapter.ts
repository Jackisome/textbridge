import type { TextCaptureResult } from '../../../core/entities/text-capture';
import type { WriteBackResult } from '../../../core/entities/write-back';
import type {
  RestoreTarget,
  SelectionContextCapture
} from '../../../shared/types/context-prompt';
import type { HelperResponse } from '../common/helper-protocol';
import type { Win32HelperSessionService } from './helper-session-service';
import {
  createWin32ProcessClient,
  type CreateWin32ProcessClientOptions,
  type Win32ProcessClient
} from './process-client';
import type {
  Win32CaptureMethod,
  Win32PromptAnchor,
  Win32SelectionContextCapabilities,
  Win32WriteMethod
} from './protocol';

export interface Win32Adapter {
  captureText(method: Win32CaptureMethod): Promise<TextCaptureResult>;
  captureSelectionContext?(method: Win32CaptureMethod): Promise<{
    success: boolean;
    data?: SelectionContextCapture;
    errorCode?: string;
    errorMessage?: string;
  }>;
  restoreSelectionTarget?(target: RestoreTarget): Promise<{
    success: boolean;
    restored: boolean;
    errorCode?: string;
    errorMessage?: string;
  }>;
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

    async captureSelectionContext(
      method: Win32CaptureMethod
    ): Promise<{
      success: boolean;
      data?: SelectionContextCapture;
      errorCode?: string;
      errorMessage?: string;
    }> {
      if (helperSession) {
        const response = await helperSession.send('capture-selection-context', {
          method
        });

        if (response.kind !== 'capture-selection-context') {
          throw new Error(
            'Received an unexpected helper response kind for capture-selection-context.'
          );
        }

        return mapSelectionContextResponse(response, method);
      }

      if (!processClient) {
        throw new Error(
          'Win32 adapter is missing both helperSession and processClient.'
        );
      }

      const response = await processClient.send({
        kind: 'capture-selection-context',
        method
      });

      if (response.kind !== 'capture-selection-context') {
        throw new Error(
          'Received an unexpected response kind for capture-selection-context.'
        );
      }

      return response.ok
        ? {
            success: true,
            data: {
              sourceText: response.text ?? '',
              captureMethod: response.method,
              anchor: mapPromptAnchor(response.anchor),
              restoreTarget: response.restoreTarget
                ? {
                    platform: 'win32',
                    token: response.restoreTarget.token
                  }
                : null,
              capabilities: mapSelectionContextCapabilities(response.capabilities)
            }
          }
        : {
            success: false,
            errorCode: response.error?.code,
            errorMessage: response.error?.message
          };
    },

    async restoreSelectionTarget(
      target: RestoreTarget
    ): Promise<{
      success: boolean;
      restored: boolean;
      errorCode?: string;
      errorMessage?: string;
    }> {
      if (target.platform !== 'win32') {
        return {
          success: false,
          restored: false,
          errorCode: 'RESTORE_TARGET_PLATFORM_UNSUPPORTED',
          errorMessage:
            'The win32 adapter can only restore targets that were captured on win32.'
        };
      }

      if (helperSession) {
        const response = await helperSession.send('restore-target', {
          token: target.token
        });

        if (response.kind !== 'restore-target') {
          throw new Error(
            'Received an unexpected helper response kind for restore-target.'
          );
        }

        return mapRestoreTargetResponse(response);
      }

      if (!processClient) {
        throw new Error(
          'Win32 adapter is missing both helperSession and processClient.'
        );
      }

      const response = await processClient.send({
        kind: 'restore-target',
        token: target.token
      });

      if (response.kind !== 'restore-target') {
        throw new Error('Received an unexpected response kind for restore-target.');
      }

      return response.ok
        ? {
            success: true,
            restored: response.restored
          }
        : {
            success: false,
            restored: response.restored,
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

function mapSelectionContextResponse(
  response: HelperResponse,
  fallbackMethod: Win32CaptureMethod
): {
  success: boolean;
  data?: SelectionContextCapture;
  errorCode?: string;
  errorMessage?: string;
} {
  const payload = asPayload(response.payload);
  const method = toCaptureMethod(payload.method, fallbackMethod);

  return response.ok
    ? {
        success: true,
        data: {
          sourceText: getString(payload, 'text') ?? '',
          captureMethod: method,
          anchor: mapPromptAnchor(getRecord(payload, 'anchor')),
          restoreTarget: mapRestoreTarget(getRecord(payload, 'restoreTarget')),
          capabilities: mapSelectionContextCapabilities(
            getRecord(payload, 'capabilities')
          )
        }
      }
    : {
        success: false,
        errorCode: response.error?.code,
        errorMessage: response.error?.message
      };
}

function mapRestoreTargetResponse(response: HelperResponse): {
  success: boolean;
  restored: boolean;
  errorCode?: string;
  errorMessage?: string;
} {
  const payload = asPayload(response.payload);
  const restored = getBoolean(payload, 'restored') ?? false;

  return response.ok
    ? {
        success: true,
        restored
      }
    : {
        success: false,
        restored,
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

function mapPromptAnchor(payload: unknown): SelectionContextCapture['anchor'] {
  if (!isRecord(payload)) {
    return {
      kind: 'unknown'
    };
  }

  const kind = toPromptAnchorKind(payload.kind);
  const boundsRecord = getRecord(payload, 'bounds');

  return {
    kind,
    ...(boundsRecord && isPromptAnchorBounds(boundsRecord)
      ? {
          bounds: {
            x: boundsRecord.x,
            y: boundsRecord.y,
            width: boundsRecord.width,
            height: boundsRecord.height
          }
        }
      : {}),
    ...(getString(payload, 'displayId')
      ? { displayId: getString(payload, 'displayId') }
      : {})
  };
}

function mapRestoreTarget(
  payload: Record<string, unknown> | undefined
): RestoreTarget | null {
  const token = getString(payload, 'token');

  return token
    ? {
        platform: 'win32',
        token
      }
    : null;
}

function mapSelectionContextCapabilities(
  payload: Win32SelectionContextCapabilities | Record<string, unknown> | undefined
): SelectionContextCapture['capabilities'] {
  if (!payload || !isRecord(payload)) {
    return {
      canPositionPromptNearSelection: false,
      canRestoreTargetAfterPrompt: false,
      canAutoWriteBackAfterPrompt: false
    };
  }

  return {
    canPositionPromptNearSelection:
      getBoolean(payload, 'canPositionPromptNearSelection') ?? false,
    canRestoreTargetAfterPrompt:
      getBoolean(payload, 'canRestoreTargetAfterPrompt') ?? false,
    canAutoWriteBackAfterPrompt:
      getBoolean(payload, 'canAutoWriteBackAfterPrompt') ?? false
  };
}

function toPromptAnchorKind(value: unknown): Win32PromptAnchor['kind'] {
  return value === 'selection-rect' ||
    value === 'control-rect' ||
    value === 'window-rect' ||
    value === 'cursor' ||
    value === 'unknown'
    ? value
    : 'unknown';
}

function isPromptAnchorBounds(
  value: Record<string, unknown>
): value is {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return (
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number'
  );
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
  record: Record<string, unknown> | undefined,
  key: string
): Record<string, unknown> | undefined {
  if (!record) {
    return undefined;
  }

  return isRecord(record[key]) ? (record[key] as Record<string, unknown>) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
