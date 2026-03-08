import { useEffect, useState } from 'react';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import type { ElectronInfo } from '../../shared/types/preload';
import { SettingsPage } from '../pages/settings-page';
import {
  areSettingsEqual,
  cloneSettings,
  loadPersistedSettings,
  savePersistedSettings
} from '../services/settings-storage';
import type { ProviderId, ProviderSettingsMap, TranslationClientSettings } from '../types/settings';

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

export default function App() {
  const [appState, setAppState] = useState<AppState>(createInitialState);
  const electronInfo = window.electronInfo ?? fallbackElectronInfo;
  const isDirty = !areSettingsEqual(appState.settings, appState.savedSettings);

  useEffect(() => {
    let disposed = false;

    void loadPersistedSettings().then((persistedSettings) => {
      if (disposed) {
        return;
      }

      setAppState({
        settings: cloneSettings(persistedSettings),
        savedSettings: cloneSettings(persistedSettings),
        isLoading: false,
        isSaving: false,
        saveMessage: '配置已从本地磁盘载入。'
      });
    });

    return () => {
      disposed = true;
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
      saveMessage: '已恢复为上次保存的配置。',
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
