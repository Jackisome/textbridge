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
});
