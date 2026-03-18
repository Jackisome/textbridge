import { describe, expect, it, vi } from 'vitest';
import { createWin32Adapter } from './adapter';

describe('createWin32Adapter', () => {
  it('maps helper capture responses into TextCaptureResult', async () => {
    const session = {
      send: vi.fn().mockResolvedValue({
        id: 'req-1',
        kind: 'capture-text',
        ok: true,
        payload: {
          method: 'uia',
          text: 'Hello from selection'
        },
        error: null
      })
    };
    const adapter = createWin32Adapter({
      helperSession: session
    });

    await expect(adapter.captureText('uia')).resolves.toEqual({
      success: true,
      method: 'uia',
      text: 'Hello from selection'
    });
    expect(session.send).toHaveBeenCalledWith('capture-text', {
      method: 'uia'
    });
  });

  it('maps helper capture failures into TextCaptureResult errors', async () => {
    const adapter = createWin32Adapter({
      helperSession: {
        send: vi.fn().mockResolvedValue({
          id: 'req-2',
          kind: 'capture-text',
          ok: false,
          payload: {
            method: 'clipboard'
          },
          error: {
            code: 'TEXT_CAPTURE_CLIPBOARD_FAILED',
            message: 'Clipboard copy did not produce text.'
          }
        })
      }
    });

    await expect(adapter.captureText('clipboard')).resolves.toEqual({
      success: false,
      method: 'clipboard',
      errorCode: 'TEXT_CAPTURE_CLIPBOARD_FAILED',
      errorMessage: 'Clipboard copy did not produce text.'
    });
  });

  it('maps helper write responses into WriteBackResult', async () => {
    const session = {
      send: vi.fn().mockResolvedValue({
        id: 'req-3',
        kind: 'write-text',
        ok: false,
        payload: {
          method: 'replace-selection'
        },
        error: {
          code: 'ACCESS_DENIED',
          message: 'The target control rejected replacement.'
        }
      })
    };
    const adapter = createWin32Adapter({
      helperSession: session
    });

    await expect(
      adapter.writeText('你好，世界', 'replace-selection', 'Hello world')
    ).resolves.toEqual({
      success: false,
      method: 'replace-selection',
      errorCode: 'ACCESS_DENIED',
      errorMessage: 'The target control rejected replacement.'
    });
    expect(session.send).toHaveBeenCalledWith('write-text', {
      method: 'replace-selection',
      text: '你好，世界',
      expectedSourceText: 'Hello world'
    });
  });

  it('uses clipboard-write helper requests for clipboard updates', async () => {
    const session = {
      send: vi.fn().mockResolvedValue({
        id: 'req-4',
        kind: 'clipboard-write',
        ok: true,
        payload: {},
        error: null
      })
    };
    const adapter = createWin32Adapter({
      helperSession: session
    });

    await expect(adapter.copyToClipboard('你好')).resolves.toBeUndefined();
    expect(session.send).toHaveBeenCalledWith('clipboard-write', {
      text: '你好'
    });
  });
});
