import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';

export interface WindowService {
  ensureMainWindow(): Promise<BrowserWindow>;
  showMainWindow(): Promise<BrowserWindow>;
  hideMainWindow(): void;
  getMainWindow(): BrowserWindow | null;
}

export interface CreateWindowServiceOptions {
  rendererDevUrl?: string;
  rendererProdHtml: string;
  preloadPath: string;
  shouldHideOnClose: () => boolean;
}

export interface CreateMainWindowOptionsInput {
  preloadPath: string;
}

export function createMainWindowOptions({
  preloadPath
}: CreateMainWindowOptionsInput): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  };
}

export function createWindowService({
  rendererDevUrl,
  rendererProdHtml,
  preloadPath,
  shouldHideOnClose
}: CreateWindowServiceOptions): WindowService {
  let mainWindow: BrowserWindow | null = null;

  async function createMainWindow(): Promise<BrowserWindow> {
    if (mainWindow && !mainWindow.isDestroyed()) {
      return mainWindow;
    }

    mainWindow = new BrowserWindow(
      createMainWindowOptions({
        preloadPath
      })
    );

    mainWindow.on('close', (event) => {
      if (!shouldHideOnClose()) {
        return;
      }

      event.preventDefault();
      mainWindow?.hide();
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    if (rendererDevUrl) {
      await mainWindow.loadURL(rendererDevUrl);
      return mainWindow;
    }

    await mainWindow.loadFile(rendererProdHtml);
    return mainWindow;
  }

  return {
    ensureMainWindow: createMainWindow,
    async showMainWindow(): Promise<BrowserWindow> {
      const windowInstance = await createMainWindow();

      if (windowInstance.isMinimized()) {
        windowInstance.restore();
      }

      windowInstance.show();
      windowInstance.focus();

      return windowInstance;
    },
    hideMainWindow(): void {
      mainWindow?.hide();
    },
    getMainWindow(): BrowserWindow | null {
      return mainWindow;
    }
  };
}
