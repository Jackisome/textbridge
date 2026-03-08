import { app, BrowserWindow, globalShortcut } from 'electron';
import path from 'node:path';

import { registerSettingsIpc } from './ipc/register-settings-ipc';
import { createShortcutService } from './services/shortcut-service';
import { createSettingsService } from './services/settings-service';

const rendererDevUrl = process.env.VITE_DEV_SERVER_URL;
const rendererProdHtml = path.join(__dirname, '..', '..', 'dist', 'index.html');
let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (rendererDevUrl) {
    await mainWindow.loadURL(rendererDevUrl);
    return;
  }

  await mainWindow.loadFile(rendererProdHtml);
}

function focusMainWindow(): void {
  if (mainWindow === null || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  mainWindow.focus();
}

void app.whenReady().then(async () => {
  const settingsService = createSettingsService(path.join(app.getPath('userData'), 'settings.json'));
  const shortcutService = createShortcutService(globalShortcut, {
    onQuickTranslate: focusMainWindow,
    onContextTranslate: focusMainWindow
  });
  const initialSettings = await settingsService.loadSettings();

  shortcutService.applySettings(initialSettings);
  registerSettingsIpc(settingsService, {
    onAfterSave: (settings) => shortcutService.applySettings(settings)
  });
  void createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });

  app.on('will-quit', () => {
    shortcutService.dispose();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
