import { BrowserWindow, screen, type BrowserWindowConstructorOptions } from 'electron';
import { pathToFileURL } from 'node:url';

import type { PromptAnchor } from '../../shared/types/context-prompt';
import { resolveContextPromptWindowBounds, type Rectangle } from './context-prompt-window-placement';

export interface ContextPromptWindowOpenOptions {
  anchor: PromptAnchor;
  sessionId?: string;
  sourceText?: string;
}

export interface ContextPromptWindowService {
  open(options: ContextPromptWindowOpenOptions): Promise<BrowserWindow>;
  close(): void;
  getWindow(): BrowserWindow | null;
}

export interface CreateContextPromptWindowServiceOptions {
  browserWindowFactory?: (options: BrowserWindowConstructorOptions) => BrowserWindow;
  preloadPath: string;
  rendererDevUrl?: string;
  rendererProdHtml?: string;
  getCursorScreenPoint?: () => { x: number; y: number };
  getDisplayNearestPoint?: (point: { x: number; y: number }) => { workArea: Rectangle };
}

function defaultGetCursorScreenPoint(): { x: number; y: number } {
  return screen.getCursorScreenPoint();
}

function defaultGetDisplayNearestPoint(point: { x: number; y: number }): { workArea: Rectangle } {
  const display = screen.getDisplayNearestPoint(point);
  return { workArea: display.workArea as Rectangle };
}

function createContextPromptWindowOptions(
  preloadPath: string,
  bounds?: { x: number; y: number; width: number; height: number }
): BrowserWindowConstructorOptions {
  return {
    width: bounds?.width ?? 480,
    height: bounds?.height ?? 360,
    minWidth: 420,
    minHeight: 280,
    x: bounds?.x,
    y: bounds?.y,
    resizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  };
}

function toContextPromptUrl(
  rendererDevUrl: string | undefined,
  rendererProdHtml: string | undefined,
  options: ContextPromptWindowOpenOptions
): string {
  const baseUrl = rendererDevUrl ?? (rendererProdHtml ? pathToFileURL(rendererProdHtml).toString() : null);

  if (!baseUrl) {
    throw new Error('A renderer URL or HTML path is required to open the context prompt window.');
  }

  const url = new URL(baseUrl);
  url.searchParams.set('view', 'context-popup');

  if (options.sessionId) {
    url.searchParams.set('sessionId', options.sessionId);
  }

  return url.toString();
}

export function createContextPromptWindowService({
  browserWindowFactory = (options) => new BrowserWindow(options),
  preloadPath,
  rendererDevUrl,
  rendererProdHtml,
  getCursorScreenPoint = defaultGetCursorScreenPoint,
  getDisplayNearestPoint = defaultGetDisplayNearestPoint
}: CreateContextPromptWindowServiceOptions): ContextPromptWindowService {
  let activeWindow: BrowserWindow | null = null;

  async function open(options: ContextPromptWindowOpenOptions): Promise<BrowserWindow> {
    if (activeWindow && !activeWindow.isDestroyed()) {
      if (activeWindow.isMinimized()) {
        activeWindow.restore();
      }

      activeWindow.show();
      activeWindow.focus();
      return activeWindow;
    }

    const cursorPoint = getCursorScreenPoint();
    const { workArea } = getDisplayNearestPoint(cursorPoint);

    const bounds = resolveContextPromptWindowBounds({
      anchor: options.anchor,
      popupSize: { width: 480, height: 360 },
      workArea,
      cursorPoint
    });

    activeWindow = browserWindowFactory(createContextPromptWindowOptions(preloadPath, bounds));
    activeWindow.on('closed', () => {
      activeWindow = null;
    });

    try {
      await activeWindow.loadURL(
        toContextPromptUrl(rendererDevUrl, rendererProdHtml, options)
      );
      activeWindow.show();
      activeWindow.focus();
    } catch (error) {
      const failedWindow = activeWindow;
      activeWindow = null;
      if (!failedWindow.isDestroyed()) {
        failedWindow.destroy();
      }
      throw error;
    }

    return activeWindow;
  }

  function close(): void {
    if (!activeWindow || activeWindow.isDestroyed()) {
      activeWindow = null;
      return;
    }

    activeWindow.close();
    activeWindow = null;
  }

  function getWindow(): BrowserWindow | null {
    return activeWindow;
  }

  return {
    open,
    close,
    getWindow
  };
}
