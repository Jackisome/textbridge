import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import type { RuntimeStatus } from '../../shared/types/ipc';
import type {
  AppSettings,
  CaptureMethodPreference,
  OutputMode,
  TranslationProviderKind
} from '../../shared/types/settings';
import { ContextPopupPage } from '../pages/context-popup-page';
import { FallbackResultPage } from '../pages/fallback-result-page';
import { SettingsPage } from '../pages/settings-page';

export default function App() {
  const { electronInfo } = window;
  const view = new URLSearchParams(window.location.search).get('view');
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadState = async () => {
      try {
        const [settings, status] = await Promise.all([
          window.textBridge.getSettings(),
          window.textBridge.getRuntimeStatus()
        ]);

        if (!active) {
          return;
        }

        setDraftSettings(settings);
        setSavedSettings(settings);
        setRuntimeStatus(status);
      } catch {
        if (!active) {
          return;
        }

        setSaveMessage('设置加载失败，请重试。');
      }
    };

    void loadState();

    if (!import.meta.env.DEV) {
      return () => {
        active = false;
      };
    }

    const intervalId = window.setInterval(() => {
      void window.textBridge.getRuntimeStatus().then((status) => {
        if (active) {
          setRuntimeStatus(status);
        }
      });
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  if (view === 'context-popup') {
    return <ContextPopupPage />;
  }

  if (view === 'fallback-result') {
    return <FallbackResultPage />;
  }

  return (
    <SettingsPage
      draftSettings={draftSettings}
      electronInfo={electronInfo}
      isSaving={isSaving}
      onBooleanFieldChange={handleBooleanFieldChange}
      onCaptureMethodChange={handleCaptureMethodChange}
      onNumberFieldChange={handleNumberFieldChange}
      onOutputModeChange={handleOutputModeChange}
      onProviderKindChange={handleProviderKindChange}
      onReset={handleReset}
      onSave={handleSave}
      onStringFieldChange={handleStringFieldChange}
      runtimeStatus={runtimeStatus}
      saveMessage={saveMessage}
    />
  );

  function handleReset() {
    setDraftSettings(savedSettings);
    setSaveMessage('已回退到最近一次保存的配置。');
  }

  function handleStringFieldChange(path: string, value: string) {
    setDraftSettings((currentSettings) => updateStringSetting(currentSettings, path, value));
    setSaveMessage(null);
  }

  function handleBooleanFieldChange(path: string, value: boolean) {
    setDraftSettings((currentSettings) => updateBooleanSetting(currentSettings, path, value));
    setSaveMessage(null);
  }

  function handleNumberFieldChange(path: string, value: number) {
    setDraftSettings((currentSettings) =>
      updateNumberSetting(currentSettings, path, Number.isFinite(value) ? value : 0)
    );
    setSaveMessage(null);
  }

  function handleProviderKindChange(kind: TranslationProviderKind) {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      provider: {
        ...currentSettings.provider,
        kind
      }
    }));
    setSaveMessage(null);
  }

  function handleOutputModeChange(mode: OutputMode) {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      writeBack: {
        ...currentSettings.writeBack,
        outputMode: mode
      }
    }));
    setSaveMessage(null);
  }

  function handleCaptureMethodChange(method: CaptureMethodPreference) {
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      capture: {
        ...currentSettings.capture,
        preferredMethod: method
      }
    }));
    setSaveMessage(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const saved = await window.textBridge.saveSettings(draftSettings);
      const status = await window.textBridge.getRuntimeStatus();

      setDraftSettings(saved);
      setSavedSettings(saved);
      setRuntimeStatus(status);
      setSaveMessage('设置已保存。');
    } catch {
      setSaveMessage('保存失败，请检查配置后重试。');
    } finally {
      setIsSaving(false);
    }
  }
}

function updateStringSetting(settings: AppSettings, path: string, value: string): AppSettings {
  switch (path) {
    case 'sourceLanguage':
      return { ...settings, sourceLanguage: value };
    case 'targetLanguage':
      return { ...settings, targetLanguage: value };
    case 'provider.endpoint':
      return {
        ...settings,
        provider: {
          ...settings.provider,
          endpoint: value
        }
      };
    case 'provider.apiKey':
      return {
        ...settings,
        provider: {
          ...settings.provider,
          apiKey: value
        }
      };
    case 'provider.model':
      return {
        ...settings,
        provider: {
          ...settings.provider,
          model: value
        }
      };
    case 'shortcuts.quickTranslate':
      return {
        ...settings,
        shortcuts: {
          ...settings.shortcuts,
          quickTranslate: value
        }
      };
    case 'shortcuts.contextTranslate':
      return {
        ...settings,
        shortcuts: {
          ...settings.shortcuts,
          contextTranslate: value
        }
      };
    default:
      return settings;
  }
}

function updateBooleanSetting(settings: AppSettings, path: string, value: boolean): AppSettings {
  switch (path) {
    case 'ui.closeMainWindowToTray':
      return {
        ...settings,
        ui: {
          ...settings.ui,
          closeMainWindowToTray: value
        }
      };
    case 'ui.startMinimized':
      return {
        ...settings,
        ui: {
          ...settings.ui,
          startMinimized: value
        }
      };
    case 'capture.allowClipboardFallback':
      return {
        ...settings,
        capture: {
          ...settings.capture,
          allowClipboardFallback: value
        }
      };
    case 'writeBack.allowPasteFallback':
      return {
        ...settings,
        writeBack: {
          ...settings.writeBack,
          allowPasteFallback: value
        }
      };
    case 'writeBack.allowPopupFallback':
      return {
        ...settings,
        writeBack: {
          ...settings.writeBack,
          allowPopupFallback: value
        }
      };
    default:
      return settings;
  }
}

function updateNumberSetting(settings: AppSettings, path: string, value: number): AppSettings {
  switch (path) {
    case 'provider.timeoutMs':
      return {
        ...settings,
        provider: {
          ...settings.provider,
          timeoutMs: value
        }
      };
    default:
      return settings;
  }
}
