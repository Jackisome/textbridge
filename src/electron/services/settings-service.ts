import fs from 'node:fs/promises';
import path from 'node:path';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import type { TranslationClientSettings } from '../../shared/types/settings';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  return value as UnknownRecord;
}

function pickString(record: UnknownRecord, key: keyof TranslationClientSettings): string | null {
  const value = record[key];

  return typeof value === 'string' ? value : null;
}

function pickBoolean(record: UnknownRecord, key: keyof TranslationClientSettings): boolean | null {
  const value = record[key];

  return typeof value === 'boolean' ? value : null;
}

function pickNumber(record: UnknownRecord, key: keyof TranslationClientSettings): number | null {
  const value = record[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeSettings(candidate: unknown): TranslationClientSettings {
  const record = asRecord(candidate);

  if (record === null) {
    return { ...defaultTranslationClientSettings };
  }

  return {
    sourceLanguage: pickString(record, 'sourceLanguage') ?? defaultTranslationClientSettings.sourceLanguage,
    targetLanguage: pickString(record, 'targetLanguage') ?? defaultTranslationClientSettings.targetLanguage,
    providerKind:
      pickString(record, 'providerKind') === 'http'
        ? 'http'
        : defaultTranslationClientSettings.providerKind,
    httpEndpoint: pickString(record, 'httpEndpoint') ?? defaultTranslationClientSettings.httpEndpoint,
    apiKey: pickString(record, 'apiKey') ?? defaultTranslationClientSettings.apiKey,
    model: pickString(record, 'model') ?? defaultTranslationClientSettings.model,
    requestTimeoutMs:
      pickNumber(record, 'requestTimeoutMs') ?? defaultTranslationClientSettings.requestTimeoutMs,
    quickTranslateShortcut:
      pickString(record, 'quickTranslateShortcut') ??
      defaultTranslationClientSettings.quickTranslateShortcut,
    contextTranslateShortcut:
      pickString(record, 'contextTranslateShortcut') ??
      defaultTranslationClientSettings.contextTranslateShortcut,
    outputMode:
      pickString(record, 'outputMode') === 'show-popup'
        ? 'show-popup'
        : defaultTranslationClientSettings.outputMode,
    captureMode:
      pickString(record, 'captureMode') === 'clipboard-first'
        ? 'clipboard-first'
        : defaultTranslationClientSettings.captureMode,
    closeToTray: pickBoolean(record, 'closeToTray') ?? defaultTranslationClientSettings.closeToTray,
    startMinimized:
      pickBoolean(record, 'startMinimized') ?? defaultTranslationClientSettings.startMinimized,
    enableClipboardFallback:
      pickBoolean(record, 'enableClipboardFallback') ??
      defaultTranslationClientSettings.enableClipboardFallback,
    enablePopupFallback:
      pickBoolean(record, 'enablePopupFallback') ?? defaultTranslationClientSettings.enablePopupFallback
  };
}

export interface SettingsService {
  loadSettings: () => Promise<TranslationClientSettings>;
  saveSettings: (settings: TranslationClientSettings) => Promise<void>;
}

export function createSettingsService(configFilePath: string): SettingsService {
  async function loadSettings(): Promise<TranslationClientSettings> {
    try {
      const rawContent = await fs.readFile(configFilePath, 'utf8');

      return normalizeSettings(JSON.parse(rawContent) as unknown);
    } catch {
      return { ...defaultTranslationClientSettings };
    }
  }

  async function saveSettings(settings: TranslationClientSettings): Promise<void> {
    const normalizedSettings = normalizeSettings(settings);

    await fs.mkdir(path.dirname(configFilePath), { recursive: true });
    await fs.writeFile(configFilePath, JSON.stringify(normalizedSettings, null, 2), 'utf8');
  }

  return {
    loadSettings,
    saveSettings
  };
}
