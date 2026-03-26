import { describe, expect, it, vi } from 'vitest';
import {
  createLoadingOverlayBrowserWindow,
  resolveLoadingOverlayWindowBounds,
  toLoadingOverlayUrl
} from './loading-overlay-window';

describe('loading overlay window helpers', () => {
  it('creates a transparent click-through overlay window', () => {
    const setIgnoreMouseEvents = vi.fn();
    const browserWindowFactory = vi.fn().mockReturnValue({
      setIgnoreMouseEvents,
      on: vi.fn()
    });

    createLoadingOverlayBrowserWindow({
      browserWindowFactory,
      preloadPath: 'C:/tmp/preload.js'
    });

    expect(browserWindowFactory).toHaveBeenCalledWith(expect.objectContaining({
      width: 40,
      height: 40,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: false,
      show: false
    }));
    expect(setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
  });

  it('builds the loading-overlay URL for both dev and packaged modes', () => {
    // Dev: rendererDevUrl is used directly
    expect(toLoadingOverlayUrl('http://127.0.0.1:5173/', undefined)).toContain('view=loading-overlay');
    // Packaged: rendererProdHtml is a filesystem path, converted to file:// URL internally
    expect(toLoadingOverlayUrl('http://127.0.0.1:5173/', 'C:\\app\\dist\\index.html'))
      .toContain('file://');
    expect(toLoadingOverlayUrl('http://127.0.0.1:5173/', 'C:\\app\\dist\\index.html'))
      .toContain('view=loading-overlay');
  });

  it('clamps bounds near the screen edge', () => {
    expect(
      resolveLoadingOverlayWindowBounds({
        cursorPoint: { x: 1915, y: 1075 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
      })
    ).toEqual({ x: 1880, y: 1040, width: 40, height: 40 });
  });
});
