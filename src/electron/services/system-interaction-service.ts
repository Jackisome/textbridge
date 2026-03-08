import type { TextCaptureResult } from '../../core/entities/text-capture';
import type { WriteBackResult } from '../../core/entities/write-back';
import {
  createWin32Adapter,
  type Win32Adapter
} from '../platform/win32/adapter';
import type {
  Win32CaptureMethod,
  Win32WriteMethod
} from '../platform/win32/protocol';

export interface SystemInteractionService {
  captureSelectedText(method?: Win32CaptureMethod): Promise<TextCaptureResult>;
  writeTranslatedText(
    text: string,
    method?: Win32WriteMethod
  ): Promise<WriteBackResult>;
}

export interface CreateSystemInteractionServiceOptions {
  adapter?: Win32Adapter;
}

export function createSystemInteractionService({
  adapter = createWin32Adapter()
}: CreateSystemInteractionServiceOptions = {}): SystemInteractionService {
  return {
    captureSelectedText(method: Win32CaptureMethod = 'uia'): Promise<TextCaptureResult> {
      return adapter.captureText(method);
    },
    writeTranslatedText(
      text: string,
      method: Win32WriteMethod = 'replace-selection'
    ): Promise<WriteBackResult> {
      return adapter.writeText(text, method);
    }
  };
}
