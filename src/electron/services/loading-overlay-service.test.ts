import { describe, expect, it, vi } from 'vitest';
import { createLoadingOverlayService } from './loading-overlay-service';

describe('createLoadingOverlayService', () => {
  it('prepares once and reuses the same hidden window for show/hide', async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const setBounds = vi.fn();
    const show = vi.fn();
    const hide = vi.fn();
    const isDestroyed = vi.fn().mockReturnValue(false);
    const createWindow = vi.fn().mockReturnValue({
      loadURL,
      setBounds,
      show,
      hide,
      isDestroyed,
      on: vi.fn()
    });

    const service = createLoadingOverlayService({
      createWindow,
      rendererDevUrl: 'http://127.0.0.1:5173/',
      rendererProdHtml: undefined,
      getDisplayNearestPoint: () => ({
        workArea: { x: 0, y: 0, width: 1280, height: 720 }
      })
    });

    await service.prepare();
    await service.showAt(1268, 708);
    service.hide();

    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(loadURL).toHaveBeenCalledTimes(1);
    expect(setBounds).toHaveBeenCalledWith({ x: 1240, y: 680, width: 40, height: 40 });
    expect(show).toHaveBeenCalledTimes(1);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('drops a broken window after load failure so a later showAt can recreate it', async () => {
    // Simulate: first window has broken loadURL, second is healthy
    let callCount = 0;
    const loadURL = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('load failed'));
      return Promise.resolve();
    });
    const show = vi.fn();
    const hide = vi.fn();
    const isDestroyed = vi.fn().mockReturnValue(false);
    const destroy = vi.fn();
    const createWindow = vi.fn().mockReturnValue({
      loadURL,
      show,
      hide,
      isDestroyed,
      destroy,
      on: vi.fn()
    });

    const service = createLoadingOverlayService({
      createWindow,
      rendererDevUrl: 'http://127.0.0.1:5173/',
      rendererProdHtml: undefined,
      getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })
    });

    // First prepare fails (load rejected)
    await service.prepare();
    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1); // broken window destroyed

    // Second prepare recreates
    await service.prepare();
    expect(createWindow).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1); // only first was destroyed
  });
});
