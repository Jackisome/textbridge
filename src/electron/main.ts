import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { registerSettingsIpc } from './ipc/register-settings-ipc';
import { createSettingsService } from './services/settings-service';

const rendererDevUrl = process.env.VITE_DEV_SERVER_URL;
const rendererProdHtml = path.join(__dirname, '..', '..', 'dist', 'index.html');
const settingsService = createSettingsService({
  settingsFilePath: path.join(app.getPath('userData'), 'settings.json')
});

async function createWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (rendererDevUrl) {
    await mainWindow.loadURL(rendererDevUrl);
    return;
  }

  await mainWindow.loadFile(rendererProdHtml);
}

void app.whenReady().then(() => {
  registerSettingsIpc(settingsService);
  void createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
