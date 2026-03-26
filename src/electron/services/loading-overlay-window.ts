import { pathToFileURL } from 'url';

export const LOADING_OVERLAY_WINDOW_SIZE = { width: 40, height: 40 };

export interface CursorPoint {
  x: number;
  y: number;
}

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function resolveLoadingOverlayWindowBounds({
  cursorPoint,
  workArea
}: {
  cursorPoint: CursorPoint;
  workArea: WorkArea;
}): WindowBounds {
  const { width, height } = LOADING_OVERLAY_WINDOW_SIZE;

  let x = cursorPoint.x + 16;
  let y = cursorPoint.y + 16;

  // Clamp so x + width <= workArea.x + workArea.width
  const maxX = workArea.x + workArea.width - width;
  if (x > maxX) {
    x = maxX;
  }

  // Clamp so y + height <= workArea.y + workArea.height
  const maxY = workArea.y + workArea.height - height;
  if (y > maxY) {
    y = maxY;
  }

  return { x, y, width, height };
}

export function toLoadingOverlayUrl(
  rendererDevUrl: string,
  rendererProdHtml: string | undefined
): string {
  let baseUrl: string;

  if (rendererProdHtml) {
    baseUrl = pathToFileURL(rendererProdHtml).href;
  } else if (rendererDevUrl) {
    baseUrl = rendererDevUrl;
  } else {
    throw new Error('Either rendererDevUrl or rendererProdHtml must be provided');
  }

  const url = new URL(baseUrl);
  url.searchParams.set('view', 'loading-overlay');
  return url.toString();
}

export interface CreateLoadingOverlayBrowserWindowOptions {
  browserWindowFactory: (options: object) => {
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
    on: (event: string, handler: () => void) => void;
  };
  preloadPath: string;
  bounds?: WindowBounds;
}

export function createLoadingOverlayBrowserWindow({
  browserWindowFactory,
  preloadPath,
  bounds
}: CreateLoadingOverlayBrowserWindowOptions): {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  on: (event: string, handler: () => void) => void;
} {
  const windowOptions = {
    width: LOADING_OVERLAY_WINDOW_SIZE.width,
    height: LOADING_OVERLAY_WINDOW_SIZE.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {})
  };

  const window = browserWindowFactory(windowOptions);

  window.setIgnoreMouseEvents(true, { forward: true });

  return window;
}
