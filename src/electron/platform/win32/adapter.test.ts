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

  it('maps helper selection-context responses into platform-neutral contracts', async () => {
    const session = {
      send: vi.fn().mockResolvedValue({
        id: 'req-2b',
        kind: 'capture-selection-context',
        ok: true,
        payload: {
          method: 'uia',
          text: 'world',
          anchor: {
            kind: 'selection-rect',
            bounds: {
              x: 10,
              y: 10,
              width: 40,
              height: 20
            },
            displayId: 'display-1'
          },
          restoreTarget: {
            token: 'hwnd:123'
          },
          capabilities: {
            canPositionPromptNearSelection: true,
            canRestoreTargetAfterPrompt: true,
            canAutoWriteBackAfterPrompt: true
          }
        },
        error: null
      })
    };
    const adapter = createWin32Adapter({
      helperSession: session
    });

    await expect(adapter.captureSelectionContext?.('uia')).resolves.toEqual({
      success: true,
      data: {
        sourceText: 'world',
        captureMethod: 'uia',
        anchor: {
          kind: 'selection-rect',
          bounds: {
            x: 10,
            y: 10,
            width: 40,
            height: 20
          },
          displayId: 'display-1'
        },
        restoreTarget: {
          platform: 'win32',
          token: 'hwnd:123'
        },
        capabilities: {
          canPositionPromptNearSelection: true,
          canRestoreTargetAfterPrompt: true,
          canAutoWriteBackAfterPrompt: true
        }
      }
    });
    expect(session.send).toHaveBeenCalledWith('capture-selection-context', {
      method: 'uia'
    });
  });

  it('maps helper restore-target responses into restore results', async () => {
    const session = {
      send: vi.fn().mockResolvedValue({
        id: 'req-2c',
        kind: 'restore-target',
        ok: true,
        payload: {
          restored: true
        },
        error: null
      })
    };
    const adapter = createWin32Adapter({
      helperSession: session
    });

    await expect(
      adapter.restoreSelectionTarget?.({
        platform: 'win32',
        token: 'hwnd:123'
      })
    ).resolves.toEqual({
      success: true,
      restored: true
    });
    expect(session.send).toHaveBeenCalledWith('restore-target', {
      token: 'hwnd:123'
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
