import type { BrowserWindow } from 'electron';
import {
  toLoadingOverlayUrl,
  resolveLoadingOverlayWindowBounds,
  type WindowBounds
} from './loading-overlay-window';

export interface LoadingOverlayService {
  prepare(): Promise<void>;
  showAt(x: number, y: number): Promise<void>;
  hide(): void;
  dispose(): void;
  getWindow(): BrowserWindow | null;
}

export interface CreateLoadingOverlayServiceOptions {
  createWindow: (options: object) => {
    loadURL: (url: string) => Promise<void>;
    setBounds: (bounds: WindowBounds) => void;
    show: () => void;
    hide: () => void;
    isDestroyed: () => boolean;
    destroy: () => void;
    on: (event: string, handler: () => void) => void;
  };
  rendererDevUrl: string;
  rendererProdHtml: string | undefined;
  getDisplayNearestPoint: (point: { x: number; y: number }) => {
    workArea: { x: number; y: number; width: number; height: number };
  };
}

export function createLoadingOverlayService({
  createWindow,
  rendererDevUrl,
  rendererProdHtml,
  getDisplayNearestPoint
}: CreateLoadingOverlayServiceOptions): LoadingOverlayService {
  let activeWindow: ReturnType<CreateLoadingOverlayServiceOptions['createWindow']> | null = null;
  let loadPromise: Promise<void> | null = null;

  function ensureWindowLoaded(): Promise<void> {
    if (loadPromise) {
      return loadPromise;
    }

    const url = toLoadingOverlayUrl(rendererDevUrl, rendererProdHtml);

    loadPromise = (async () => {
      activeWindow = createWindow({});
      await activeWindow.loadURL(url);
    })();

    loadPromise.catch(() => {
      // On load failure, destroy the broken window
      if (activeWindow && !activeWindow.isDestroyed()) {
        activeWindow.destroy();
      }
      activeWindow = null;
      loadPromise = null;
    });

    return loadPromise;
  }

  return {
    async prepare(): Promise<void> {
      await ensureWindowLoaded().catch(() => undefined);
    },

    async showAt(x: number, y: number): Promise<void> {
      await ensureWindowLoaded();

      if (!activeWindow || activeWindow.isDestroyed()) {
        // Window was broken and destroyed, recreate it
        loadPromise = null;
        await ensureWindowLoaded();
      }

      if (!activeWindow) {
        return;
      }

      const display = getDisplayNearestPoint({ x, y });
      const bounds = resolveLoadingOverlayWindowBounds({
        cursorPoint: { x, y },
        workArea: display.workArea
      });

      activeWindow.setBounds(bounds);
      activeWindow.show();
    },

    hide(): void {
      activeWindow?.hide();
    },

    dispose(): void {
      if (activeWindow && !activeWindow.isDestroyed()) {
        activeWindow.destroy();
      }
      activeWindow = null;
      loadPromise = null;
    },

    getWindow(): BrowserWindow | null {
      return activeWindow as BrowserWindow | null;
    }
  };
}
