import { describe, expect, it, vi } from 'vitest';

import { createContextPromptWindowService } from './context-prompt-window-service';

describe('createContextPromptWindowService', () => {
  it('opens a skip-taskbar popup window for the active prompt session', async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const show = vi.fn();
    const focus = vi.fn();
    const isDestroyed = vi.fn().mockReturnValue(false);
    const isMinimized = vi.fn().mockReturnValue(false);
    const browserWindowFactory = vi.fn().mockReturnValue({
      loadURL,
      show,
      focus,
      isDestroyed,
      isMinimized,
      on: vi.fn(),
      close: vi.fn()
    });

    const service = createContextPromptWindowService({
      browserWindowFactory,
      preloadPath: 'C:/tmp/preload.js',
      rendererDevUrl: 'http://localhost:5173/',
      getCursorScreenPoint: () => ({ x: 640, y: 400 }),
      getDisplayNearestPoint: () => ({
        workArea: { x: 0, y: 0, width: 1280, height: 720 }
      })
    });

    await service.open({
      sourceText: 'Translate this',
      anchor: { kind: 'cursor' }
    });

    expect(browserWindowFactory).toHaveBeenCalledTimes(1);
    const createOpts = browserWindowFactory.mock.calls[0][0];
    expect(createOpts).toMatchObject({
      skipTaskbar: true,
      autoHideMenuBar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: expect.objectContaining({
        preload: 'C:/tmp/preload.js',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      })
    });
    // x/y should be set from resolved anchor bounds
    expect(createOpts.x).toBeDefined();
    expect(createOpts.y).toBeDefined();
    expect(loadURL).toHaveBeenCalledWith(
      expect.stringContaining('view=context-popup')
    );
    expect(show).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('uses anchor bounds for popup positioning', async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const show = vi.fn();
    const focus = vi.fn();
    const isDestroyed = vi.fn().mockReturnValue(false);
    const isMinimized = vi.fn().mockReturnValue(false);
    const browserWindowFactory = vi.fn().mockReturnValue({
      loadURL,
      show,
      focus,
      isDestroyed,
      isMinimized,
      on: vi.fn(),
      close: vi.fn()
    });

    const service = createContextPromptWindowService({
      browserWindowFactory,
      preloadPath: 'C:/tmp/preload.js',
      rendererDevUrl: 'http://localhost:5173/',
      getCursorScreenPoint: () => ({ x: 640, y: 400 }),
      getDisplayNearestPoint: () => ({
        workArea: { x: 0, y: 0, width: 1280, height: 720 }
      })
    });

    await service.open({
      sourceText: 'Translate this',
      anchor: {
        kind: 'control-rect',
        bounds: { x: 100, y: 80, width: 400, height: 40 }
      }
    });

    const createOpts = browserWindowFactory.mock.calls[0][0];
    // Popup should be placed below the control rect: y = 80 + 40 = 120
    expect(createOpts.x).toBe(100);
    expect(createOpts.y).toBe(120);
    expect(createOpts.width).toBe(480);
    expect(createOpts.height).toBe(360);
  });

  it('destroys a broken popup window and creates a fresh one after load failure', async () => {
    const firstLoadURL = vi.fn().mockRejectedValue(new Error('load failed'));
    const secondLoadURL = vi.fn().mockResolvedValue(undefined);
    const firstClose = vi.fn();
    const firstDestroy = vi.fn();
    const secondShow = vi.fn();
    const secondFocus = vi.fn();
    const firstWindow = {
      loadURL: firstLoadURL,
      show: vi.fn(),
      focus: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      isMinimized: vi.fn().mockReturnValue(false),
      on: vi.fn(),
      close: firstClose,
      destroy: firstDestroy
    };
    const secondWindow = {
      loadURL: secondLoadURL,
      show: secondShow,
      focus: secondFocus,
      isDestroyed: vi.fn().mockReturnValue(false),
      isMinimized: vi.fn().mockReturnValue(false),
      on: vi.fn(),
      close: vi.fn(),
      destroy: vi.fn()
    };
    const browserWindowFactory = vi
      .fn()
      .mockReturnValueOnce(firstWindow)
      .mockReturnValueOnce(secondWindow);

    const service = createContextPromptWindowService({
      browserWindowFactory,
      preloadPath: 'C:/tmp/preload.js',
      rendererDevUrl: 'http://localhost:5173/',
      getCursorScreenPoint: () => ({ x: 640, y: 400 }),
      getDisplayNearestPoint: () => ({
        workArea: { x: 0, y: 0, width: 1280, height: 720 }
      })
    });

    await expect(
      service.open({
        sourceText: 'broken first attempt',
        anchor: { kind: 'cursor' }
      })
    ).rejects.toThrow('load failed');

    expect(firstDestroy).toHaveBeenCalledTimes(1);
    expect(firstClose).not.toHaveBeenCalled();

    await service.open({
      sourceText: 'second attempt',
      anchor: { kind: 'cursor' }
    });

    expect(browserWindowFactory).toHaveBeenCalledTimes(2);
    expect(secondLoadURL).toHaveBeenCalledTimes(1);
    expect(secondShow).toHaveBeenCalledTimes(1);
    expect(secondFocus).toHaveBeenCalledTimes(1);
  });
});
