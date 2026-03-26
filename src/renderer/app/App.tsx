import { useEffect, useState } from 'react';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import type { RuntimeStatus } from '../../shared/types/ipc';
import type { ElectronInfo } from '../../shared/types/preload';
import { LoadingOverlayPage } from '../pages/LoadingOverlayPage';
import { ContextPopupPage } from '../pages/context-popup-page';
import { FallbackResultPage } from '../pages/fallback-result-page';
import { SettingsPage } from '../pages/settings-page';
import {
  cancelContextPrompt,
  getContextPromptSession,
  submitContextPrompt
} from '../services/context-prompt-api';
import {
  areSettingsEqual,
  cloneSettings,
  loadPersistedSettings,
  savePersistedSettings
} from '../services/settings-storage';
import type { PromptSession } from '../../shared/types/context-prompt';
import type {
  ProviderId,
  ProviderSettingsMap,
  TranslationClientSettings
} from '../types/settings';

interface AppState {
  settings: TranslationClientSettings;
  savedSettings: TranslationClientSettings;
  isLoading: boolean;
  isSaving: boolean;
  saveMessage: string | null;
}

const fallbackElectronInfo: ElectronInfo = {
  chrome: '--',
  electron: '--',
  node: '--',
  platform: 'unknown'
};

function createInitialState(): AppState {
  return {
    settings: cloneSettings(defaultTranslationClientSettings),
    savedSettings: cloneSettings(defaultTranslationClientSettings),
    isLoading: true,
    isSaving: false,
    saveMessage: '正在读取本地配置...'
  };
}

type ContextPromptRouteState = 'loading' | 'loaded' | 'missing-session';

function ContextPromptStatusPage({
  message,
  onCancel,
  isCancelling = false
}: {
  message: string;
  onCancel: () => Promise<void> | void;
  isCancelling?: boolean;
}) {
  return (
    <main className="popup-shell">
      <section className="popup-card">
        <span className="popup-kicker">Context Prompt</span>
        <header className="popup-header">
          <div>
            <h1>Context Translation</h1>
            <p className="popup-copy">{message}</p>
          </div>
        </header>

        <div className="popup-source">
          <strong>Prompt Session</strong>
          <p>Waiting for a ready prompt session from the main process.</p>
        </div>

        <div className="popup-actions">
          <button
            className="popup-button ghost"
            type="button"
            onClick={() => {
              void onCancel();
            }}
            disabled={isCancelling}
          >
            Cancel
          </button>
        </div>
      </section>
    </main>
  );
}

function SettingsRoute() {
  const [appState, setAppState] = useState<AppState>(createInitialState);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const electronInfo = window.electronInfo ?? fallbackElectronInfo;
  const isDirty = !areSettingsEqual(appState.settings, appState.savedSettings);

  useEffect(() => {
    let disposed = false;

    const loadState = async () => {
      const [persistedSettings, latestRuntimeStatus] = await Promise.all([
        loadPersistedSettings(),
        window.textBridge.getRuntimeStatus().catch(() => null)
      ]);

      if (disposed) {
        return;
      }

      setRuntimeStatus(latestRuntimeStatus);
      setAppState({
        settings: cloneSettings(persistedSettings),
        savedSettings: cloneSettings(persistedSettings),
        isLoading: false,
        isSaving: false,
        saveMessage: '配置已从本地磁盘载入。'
      });
    };

    void loadState();

    if (!import.meta.env.DEV) {
      return () => {
        disposed = true;
      };
    }

    const intervalId = window.setInterval(() => {
      void window.textBridge.getRuntimeStatus().then((latestRuntimeStatus) => {
        if (!disposed) {
          setRuntimeStatus(latestRuntimeStatus);
        }
      });
    }, 2000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  function handleSettingChange<Key extends keyof TranslationClientSettings>(
    key: Key,
    value: TranslationClientSettings[Key]
  ) {
    setAppState((previousState) => ({
      ...previousState,
      saveMessage: null,
      settings: {
        ...previousState.settings,
        [key]: value
      }
    }));
  }

  function handleActiveProviderChange(providerId: ProviderId) {
    setAppState((previousState) => ({
      ...previousState,
      saveMessage: null,
      settings: {
        ...previousState.settings,
        activeProviderId: providerId
      }
    }));
  }

  function handleProviderSettingsChange(
    providerId: ProviderId,
    nextSettings: ProviderSettingsMap[ProviderId]
  ) {
    setAppState((previousState) => ({
      ...previousState,
      saveMessage: null,
      settings: {
        ...previousState.settings,
        providers: {
          ...previousState.settings.providers,
          [providerId]: nextSettings
        }
      }
    }));
  }

  async function handleSave() {
    setAppState((previousState) => ({
      ...previousState,
      isSaving: true,
      saveMessage: '正在保存配置...'
    }));

    await savePersistedSettings(cloneSettings(appState.settings));
    const latestRuntimeStatus = await window.textBridge.getRuntimeStatus().catch(() => null);

    setRuntimeStatus(latestRuntimeStatus);
    setAppState((previousState) => ({
      ...previousState,
      isSaving: false,
      saveMessage: '配置已写入本地磁盘，快捷键已立即重载。',
      savedSettings: cloneSettings(previousState.settings)
    }));
  }

  function handleReset() {
    setAppState((previousState) => ({
      ...previousState,
      saveMessage: '已放弃未保存的更改。',
      settings: cloneSettings(previousState.savedSettings)
    }));
  }

  return (
    <SettingsPage
      electronInfo={electronInfo}
      isDirty={isDirty}
      isLoading={appState.isLoading}
      isSaving={appState.isSaving}
      saveMessage={appState.saveMessage}
      runtimeStatus={runtimeStatus}
      settings={appState.settings}
      onActiveProviderChange={handleActiveProviderChange}
      onProviderSettingsChange={handleProviderSettingsChange}
      onReset={handleReset}
      onSave={() => {
        void handleSave();
      }}
      onSettingChange={handleSettingChange}
    />
  );
}

function ContextPopupRoute() {
  const [routeState, setRouteState] = useState<ContextPromptRouteState>('loading');
  const [session, setSession] = useState<PromptSession | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    let disposed = false;

    const loadSession = async () => {
      const nextSession = await getContextPromptSession().catch(() => null);

      if (disposed) {
        return;
      }

      setSession(nextSession);
      setRouteState(nextSession === null ? 'missing-session' : 'loaded');
    };

    void loadSession();

    return () => {
      disposed = true;
    };
  }, []);

  async function handleCancel() {
    if (isCancelling) {
      return;
    }

    setIsCancelling(true);

    try {
      await cancelContextPrompt();
    } finally {
      setIsCancelling(false);
    }
  }

  if (routeState === 'loading') {
    return (
      <ContextPromptStatusPage
        message="正在读取上下文会话，请稍候。"
        onCancel={handleCancel}
        isCancelling={isCancelling}
      />
    );
  }

  if (routeState === 'missing-session' || session === null) {
    return (
      <ContextPromptStatusPage
        message="上下文会话不可用，无法提交提示。"
        onCancel={handleCancel}
        isCancelling={isCancelling}
      />
    );
  }

  return (
    <ContextPopupPage
      sourceText={session.sourceText}
      onCancel={handleCancel}
      onSubmit={submitContextPrompt}
    />
  );
}

function FallbackResultRoute() {
  return <FallbackResultPage />;
}

function LoadingOverlayRoute() {
  return <LoadingOverlayPage />;
}

export default function App() {
  const view = new URLSearchParams(window.location.search).get('view');

  if (view === 'context-popup') {
    return <ContextPopupRoute />;
  }

  if (view === 'fallback-result') {
    return <FallbackResultRoute />;
  }

  if (view === 'loading-overlay') {
    return <LoadingOverlayRoute />;
  }

  return <SettingsRoute />;
}
