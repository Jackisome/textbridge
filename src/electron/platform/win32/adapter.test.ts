import { describe, expect, it } from 'vitest';
import { createWin32Adapter } from './adapter';

describe('createWin32Adapter', () => {
  it('normalizes helper process capture responses to TextCaptureResult', async () => {
    const adapter = createWin32Adapter({
      client: {
        async send() {
          return {
            kind: 'capture-text',
            ok: true,
            method: 'uia',
            text: 'Hello from selection'
          };
        }
      }
    });

    await expect(adapter.captureText('uia')).resolves.toEqual({
      success: true,
      method: 'uia',
      text: 'Hello from selection'
    });
  });

  it('normalizes helper process write responses to WriteBackResult', async () => {
    const adapter = createWin32Adapter({
      client: {
        async send() {
          return {
            kind: 'write-text',
            ok: false,
            method: 'replace-selection',
            error: {
              code: 'ACCESS_DENIED',
              message: 'The target control rejected replacement.'
            }
          };
        }
      }
    });

    await expect(
      adapter.writeText('你好，世界', 'replace-selection')
    ).resolves.toEqual({
      success: false,
      method: 'replace-selection',
      errorCode: 'ACCESS_DENIED',
      errorMessage: 'The target control rejected replacement.'
    });
  });
});
