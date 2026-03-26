import { app, globalShortcut, screen, BrowserWindow } from 'electron';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { DEFAULT_SETTINGS } from '../shared/constants/default-settings';
import { registerContextPromptIpc } from './ipc/register-context-prompt-ipc';
import { registerSettingsIpc } from './ipc/register-settings-ipc';
import { createDefaultProviderRegistry } from './services/providers/provider-registry';
import { createContextPromptSessionService } from './services/context-prompt-session-service';
import { createContextPromptRequestService } from './services/context-prompt-request-service';
import { createContextPromptWindowService } from './services/context-prompt-window-service';
import { createWin32Adapter } from './platform/win32/adapter';
import { createWin32HelperSessionService } from './platform/win32/helper-session-service';
import { createContextTranslationRunner } from './services/context-translation-runner';
import { createDiagnosticLogService } from './services/diagnostic-log-service';
import { createExecutionReportService } from './services/execution-report-service';
import { createPopupService } from './services/popup-service';
import { createQuickTranslationRunner } from './services/quick-translation-runner';
import { createSettingsService } from './services/settings-service';
import { createShortcutService } from './services/shortcut-service';
import { createSystemInteractionService } from './services/system-interaction-service';
import { createTrayService } from './services/tray-service';
import { createTranslationProviderService } from './services/translation-provider-service';
import { createWindowService } from './services/window-service';
import { runWithReleasedMainWindow } from './services/window-focus-guard';
import { createNotificationService } from './platform/notification-factory';
import { createLoadingOverlayService } from './services/loading-overlay-service';

const rendererDevUrl = process.env.VITE_DEV_SERVER_URL;
const rendererProdHtml = path.join(__dirname, '..', '..', 'dist', 'index.html');
const settingsService = createSettingsService({
  settingsFilePath: path.join(app.getPath('userData'), 'settings.json')
});
const executionReportService = createExecutionReportService();
let currentSettings = DEFAULT_SETTINGS;
let isQuitting = false;
let helperSessionService:
  | ReturnType<typeof createWin32HelperSessionService>
  | null = null;
let quickTranslationRunner:
  | ReturnType<typeof createQuickTranslationRunner>
  | null = null;
let contextTranslationRunner:
  | ReturnType<typeof createContextTranslationRunner>
  | null = null;
let diagnosticLogService:
  | ReturnType<typeof createDiagnosticLogService>
  | null = null;

const windowService = createWindowService({
  rendererDevUrl,
  rendererProdHtml,
  preloadPath: path.join(__dirname, 'preload.js'),
  shouldHideOnClose: () => !isQuitting && currentSettings.closeToTray
});

let isQuickTranslationActive = false;

const loadingOverlayService = createLoadingOverlayService({
  createWindow: () => new BrowserWindow({
    width: 200,
    height: 80,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  }) as unknown as { loadURL: (url: string) => Promise<void>; setBounds: (bounds: object) => void; show: () => void; hide: () => void; isDestroyed: () => boolean; destroy: () => void; on: (event: string, handler: () => void) => void },
  rendererDevUrl: rendererDevUrl ?? '',
  rendererProdHtml,
  getDisplayNearestPoint: (point) => screen.getDisplayNearestPoint(point)
});

const shortcutService = createShortcutService({
  registrar: globalShortcut,
  handlers: {
    onQuickTranslate() {
      if (isQuickTranslationActive) return; // re-entry protection

      const runner = quickTranslationRunner;

      if (!runner) {
        void windowService.showMainWindow();
        return;
      }

      isQuickTranslationActive = true;
      const cursorPoint = screen.getCursorScreenPoint();

      // overlay show 失败只记录，不阻断主流程
      loadingOverlayService.showAt(cursorPoint.x, cursorPoint.y).catch(() => {
        // silent - overlay is UX enhancement only
      });

      void runWithReleasedMainWindow(
        windowService.getMainWindow(),
        () => runTranslationWorkflow('quick-translation', () => runner.run()),
        (ms) => setTimeout(ms)
      ).finally(() => {
        loadingOverlayService.hide();
        isQuickTranslationActive = false;
      });
    },
    onContextTranslate() {
      const runner = contextTranslationRunner;

      if (!runner) {
        void windowService.showMainWindow();
        return;
      }

      void runWithReleasedMainWindow(
        windowService.getMainWindow(),
        () => runTranslationWorkflow('context-translation', () => runner.run()),
        (ms) => setTimeout(ms)
      );
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
  diagnosticLogService = createDiagnosticLogService({
    isPackaged: app.isPackaged,
    baseDirectoryPath: app.getPath('userData')
  });
  const contextPromptSessionService = createContextPromptSessionService();
  const contextPromptWindowService = createContextPromptWindowService({
    rendererDevUrl,
    rendererProdHtml,
    preloadPath: path.join(__dirname, 'preload.js')
  });
  const contextPromptRequestService = createContextPromptRequestService({
    promptSessionService: contextPromptSessionService,
    promptWindowService: contextPromptWindowService
  });

  helperSessionService = createWin32HelperSessionService({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    logger: diagnosticLogService
  });

  const systemInteractionService = createSystemInteractionService({
    adapter: createWin32Adapter({
      helperSession: helperSessionService
    })
  });
  const translationProviderService = createTranslationProviderService({
    registry: createDefaultProviderRegistry()
  });
  const notificationService = createNotificationService();
  const popupService = createPopupService({
    requestContextInstructions: (sourceText, anchor) =>
      contextPromptRequestService.requestContextInstructions(sourceText, anchor),
    async showFallbackResult(payload) {
      try {
        await diagnosticLogService?.info(`[Fallback] showFallbackResult called with: ${JSON.stringify({ translatedTextLength: payload.translatedText.length, sourceTextLength: payload.sourceText.length })}`);
        const settings = await settingsService.getSettings();
        await diagnosticLogService?.info(`[Fallback] enablePopupFallback=${settings.enablePopupFallback}`);
        if (settings.enablePopupFallback) {
          await diagnosticLogService?.info('[Fallback] Showing notification...');
          notificationService.show({
            title: 'TextBridge',
            hint: '翻译结果已复制到剪切板',
            body: payload.translatedText,
            autoCloseMs: 10000,
          });
          await diagnosticLogService?.info('[Fallback] notificationService.show() completed');
        }
      } catch (error) {
        await diagnosticLogService?.error(`[Fallback] showFallbackResult error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    async showSettings() {
      await windowService.showMainWindow();
    }
  });

  quickTranslationRunner = createQuickTranslationRunner({
    settingsService,
    systemInteractionService,
    translationProviderService,
    popupFallbackPresenter: {
      showResult(payload) {
        return popupService.showFallbackResult(payload);
      }
    },
    reportRecorder: executionReportService
  });

  contextTranslationRunner = createContextTranslationRunner({
    settingsService,
    systemInteractionService,
    translationProviderService,
    popupService,
    reportRecorder: executionReportService
  });

  trayService.ensureTray();
  void loadingOverlayService.prepare(); // best-effort，不阻塞主窗口创建
  shortcutService.applySettings(currentSettings);

  registerSettingsIpc({
    settingsService,
    async onAfterSave(savedSettings) {
      currentSettings = savedSettings;
      shortcutService.applySettings(savedSettings);
      await diagnosticLogService?.info('Settings saved and shortcuts reapplied.');
    },
    runtimeStatusProvider: {
      async getRuntimeStatus() {
        const helperSnapshot = helperSessionService?.getSnapshot();

        return executionReportService.getRuntimeStatus({
          ready: true,
          platform: process.platform,
          activeProvider: currentSettings.activeProviderId,
          registeredShortcuts: shortcutService.getRegisteredShortcuts(),
          helperState: helperSnapshot?.helperState,
          helperLastErrorCode: helperSnapshot?.helperLastErrorCode,
          helperPid: helperSnapshot?.helperPid
        });
      }
    }
  });

  registerContextPromptIpc({
    promptSessionService: contextPromptSessionService,
    promptWindowService: contextPromptWindowService
  });

  const mainWindow = await windowService.ensureMainWindow();

  if (currentSettings.startMinimized) {
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
  void helperSessionService?.dispose();
  shortcutService.dispose();
  trayService.dispose();
});

async function handleRunnerFailure(
  workflow: 'quick-translation' | 'context-translation',
  error: unknown
): Promise<void> {
  await diagnosticLogService?.error(
    error instanceof Error
      ? `${workflow} failed: ${error.message}`
      : `${workflow} failed with a non-error value.`
  );
}

async function runTranslationWorkflow(
  workflow: 'quick-translation' | 'context-translation',
  execute: () => Promise<unknown>
): Promise<void> {
  try {
    await execute();
  } catch (error) {
    await handleRunnerFailure(workflow, error);
  }
}
