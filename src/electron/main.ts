import { app, globalShortcut } from 'electron';
import path from 'node:path';
import { DEFAULT_SETTINGS } from '../shared/constants/default-settings';
import { registerSettingsIpc } from './ipc/register-settings-ipc';
import { createExecutionReportService } from './services/execution-report-service';
import { createSettingsService } from './services/settings-service';
import { createShortcutService } from './services/shortcut-service';
import { createTrayService } from './services/tray-service';
import { createWindowService } from './services/window-service';

const rendererDevUrl = process.env.VITE_DEV_SERVER_URL;
const rendererProdHtml = path.join(__dirname, '..', '..', 'dist', 'index.html');
const settingsService = createSettingsService({
  settingsFilePath: path.join(app.getPath('userData'), 'settings.json')
});
const executionReportService = createExecutionReportService();
let currentSettings = DEFAULT_SETTINGS;
let isQuitting = false;

const windowService = createWindowService({
  rendererDevUrl,
  rendererProdHtml,
  preloadPath: path.join(__dirname, 'preload.js'),
  shouldHideOnClose: () => !isQuitting && currentSettings.ui.closeMainWindowToTray
});

const shortcutService = createShortcutService({
  registrar: globalShortcut,
  handlers: {
    onQuickTranslate() {
      void windowService.showMainWindow();
    },
    onContextTranslate() {
      void windowService.showMainWindow();
    }
  }
});

const trayService = createTrayService({
  onOpenSettings() {
    void windowService.showMainWindow();
  },
  onExit() {
    isQuitting = true;
  }
});

void app.whenReady().then(async () => {
  currentSettings = await settingsService.getSettings();

  trayService.ensureTray();
  shortcutService.applySettings(currentSettings);

  registerSettingsIpc({
    settingsService,
    runtimeStatusProvider: {
      async getRuntimeStatus() {
        const settings = await settingsService.getSettings();

        return executionReportService.getRuntimeStatus({
          ready: true,
          platform: process.platform,
          activeProvider: settings.provider.kind,
          registeredShortcuts: shortcutService.getRegisteredShortcuts()
        });
      }
    }
  });

  const mainWindow = await windowService.ensureMainWindow();

  if (currentSettings.ui.startMinimized) {
    mainWindow.hide();
  }

  app.on('activate', () => {
    void windowService.showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  shortcutService.dispose();
  trayService.dispose();
});
