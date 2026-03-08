import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import type { TranslationClientSettings } from '../../shared/types/settings';

export function cloneSettings(settings: TranslationClientSettings): TranslationClientSettings {
  return structuredClone(settings);
}

export function areSettingsEqual(
  left: TranslationClientSettings,
  right: TranslationClientSettings
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function loadPersistedSettings(): Promise<TranslationClientSettings> {
  if (typeof window === 'undefined' || window.textBridge === undefined) {
    return cloneSettings(defaultTranslationClientSettings);
  }

  return cloneSettings(await window.textBridge.getSettings());
}

export async function savePersistedSettings(settings: TranslationClientSettings): Promise<void> {
  if (typeof window === 'undefined' || window.textBridge === undefined) {
    return;
  }

  await window.textBridge.saveSettings(cloneSettings(settings));
}
