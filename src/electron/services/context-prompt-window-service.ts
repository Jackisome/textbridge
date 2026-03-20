import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import { pathToFileURL } from 'node:url';

import type { PromptAnchor } from '../../shared/types/context-prompt';

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
}

function createContextPromptWindowOptions(
  preloadPath: string
): BrowserWindowConstructorOptions {
  return {
    width: 480,
    height: 360,
    minWidth: 420,
    minHeight: 280,
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
  rendererProdHtml
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

    activeWindow = browserWindowFactory(createContextPromptWindowOptions(preloadPath));
    activeWindow.on('closed', () => {
      activeWindow = null;
    });

    await activeWindow.loadURL(
      toContextPromptUrl(rendererDevUrl, rendererProdHtml, options)
    );
    activeWindow.show();
    activeWindow.focus();

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
