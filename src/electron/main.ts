import { app, globalShortcut } from 'electron';
import path from 'node:path';
import { DEFAULT_SETTINGS } from '../shared/constants/default-settings';
import { registerContextPromptIpc } from './ipc/register-context-prompt-ipc';
import { registerSettingsIpc } from './ipc/register-settings-ipc';
import { createDefaultProviderRegistry } from './services/providers/provider-registry';
import { createContextPromptSessionService } from './services/context-prompt-session-service';
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

const shortcutService = createShortcutService({
  registrar: globalShortcut,
  handlers: {
    onQuickTranslate() {
      const runner = quickTranslationRunner;

      if (!runner) {
        void windowService.showMainWindow();
        return;
      }

      void runTranslationWorkflow('quick-translation', () => runner.run());
    },
    onContextTranslate() {
      const runner = contextTranslationRunner;

      if (!runner) {
        void windowService.showMainWindow();
        return;
      }

      void runTranslationWorkflow('context-translation', () => runner.run());
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
  const popupService = createPopupService({
    async requestContextInstructions() {
      await diagnosticLogService?.warn(
        'Context instructions UI is not implemented yet; proceeding without extra instructions.'
      );
      return '';
    },
    async showFallbackResult() {
      await windowService.showMainWindow();
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
  await windowService.showMainWindow();
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
