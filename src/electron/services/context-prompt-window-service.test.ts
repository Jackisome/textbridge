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
      rendererDevUrl: 'http://localhost:5173/'
    });

    await service.open({
      sourceText: 'Translate this',
      anchor: { kind: 'cursor' }
    });

    expect(browserWindowFactory).toHaveBeenCalledTimes(1);
    expect(browserWindowFactory).toHaveBeenCalledWith(
      expect.objectContaining({
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
      })
    );
    expect(loadURL).toHaveBeenCalledWith(
      expect.stringContaining('view=context-popup')
    );
    expect(show).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
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
      rendererDevUrl: 'http://localhost:5173/'
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
