import fs from 'node:fs/promises';
import path from 'node:path';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import { providerIds } from '../../shared/types/provider';
import type { TranslationClientSettings } from '../../shared/types/settings';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  return value as UnknownRecord;
}

function pickString(record: UnknownRecord, key: string): string | null {
  const value = record[key];

  return typeof value === 'string' ? value : null;
}

function pickBoolean(record: UnknownRecord, key: string): boolean | null {
  const value = record[key];

  return typeof value === 'boolean' ? value : null;
}

function pickNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isProviderId(value: string | null): value is TranslationClientSettings['activeProviderId'] {
  return value !== null && providerIds.includes(value as (typeof providerIds)[number]);
}

function cloneDefaultSettings(): TranslationClientSettings {
  return structuredClone(defaultTranslationClientSettings);
}

function normalizePromptTemplateProviderSettings<
  Settings extends {
    apiKey: string;
    model: string;
    baseUrl: string;
    systemPrompt: string;
    userPromptTemplate: string;
    timeoutMs: number;
  }
>(candidate: unknown, defaults: Settings): Settings {
  const record = asRecord(candidate);

  if (record === null) {
    return { ...defaults };
  }

  return {
    ...defaults,
    apiKey: pickString(record, 'apiKey') ?? defaults.apiKey,
    model: pickString(record, 'model') ?? defaults.model,
    baseUrl: pickString(record, 'baseUrl') ?? defaults.baseUrl,
    systemPrompt: pickString(record, 'systemPrompt') ?? defaults.systemPrompt,
    userPromptTemplate: pickString(record, 'userPromptTemplate') ?? defaults.userPromptTemplate,
    timeoutMs: pickNumber(record, 'timeoutMs') ?? defaults.timeoutMs
  };
}

function normalizeGeminiSettings(candidate: unknown): TranslationClientSettings['providers']['gemini'] {
  const defaults = defaultTranslationClientSettings.providers.gemini;
  const record = asRecord(candidate);

  if (record === null) {
    return { ...defaults };
  }

  return {
    ...defaults,
    apiKey: pickString(record, 'apiKey') ?? defaults.apiKey,
    model: pickString(record, 'model') ?? defaults.model,
    baseUrl: pickString(record, 'baseUrl') ?? defaults.baseUrl,
    userPromptTemplate: pickString(record, 'userPromptTemplate') ?? defaults.userPromptTemplate,
    timeoutMs: pickNumber(record, 'timeoutMs') ?? defaults.timeoutMs
  };
}

function normalizeGoogleSettings(candidate: unknown): TranslationClientSettings['providers']['google'] {
  const defaults = defaultTranslationClientSettings.providers.google;
  const record = asRecord(candidate);

  if (record === null) {
    return { ...defaults };
  }

  return {
    ...defaults,
    baseUrl: pickString(record, 'baseUrl') ?? defaults.baseUrl,
    timeoutMs: pickNumber(record, 'timeoutMs') ?? defaults.timeoutMs
  };
}

function normalizeTencentSettings(candidate: unknown): TranslationClientSettings['providers']['tencent'] {
  const defaults = defaultTranslationClientSettings.providers.tencent;
  const record = asRecord(candidate);

  if (record === null) {
    return { ...defaults };
  }

  return {
    ...defaults,
    secretId: pickString(record, 'secretId') ?? defaults.secretId,
    secretKey: pickString(record, 'secretKey') ?? defaults.secretKey,
    region: pickString(record, 'region') ?? defaults.region,
    baseUrl: pickString(record, 'baseUrl') ?? defaults.baseUrl,
    timeoutMs: pickNumber(record, 'timeoutMs') ?? defaults.timeoutMs
  };
}

function normalizeCustomSettings(candidate: unknown): TranslationClientSettings['providers']['custom'] {
  const defaults = defaultTranslationClientSettings.providers.custom;
  const record = asRecord(candidate);

  if (record === null) {
    return { ...defaults };
  }

  return {
    ...defaults,
    apiKey: pickString(record, 'apiKey') ?? defaults.apiKey,
    model: pickString(record, 'model') ?? defaults.model,
    baseUrl: pickString(record, 'baseUrl') ?? defaults.baseUrl,
    requestFormat:
      pickString(record, 'requestFormat') === 'openai-chat'
        ? 'openai-chat'
        : defaults.requestFormat,
    systemPrompt: pickString(record, 'systemPrompt') ?? defaults.systemPrompt,
    userPromptTemplate: pickString(record, 'userPromptTemplate') ?? defaults.userPromptTemplate,
    timeoutMs: pickNumber(record, 'timeoutMs') ?? defaults.timeoutMs
  };
}

function normalizeMockSettings(candidate: unknown): TranslationClientSettings['providers']['mock'] {
  const defaults = defaultTranslationClientSettings.providers.mock;
  const record = asRecord(candidate);

  if (record === null) {
    return { ...defaults };
  }

  return {
    ...defaults,
    prefix: pickString(record, 'prefix') ?? defaults.prefix,
    latencyMs: pickNumber(record, 'latencyMs') ?? defaults.latencyMs
  };
}

function normalizeProviders(candidate: unknown): TranslationClientSettings['providers'] {
  const record = asRecord(candidate);

  return {
    mock: normalizeMockSettings(record?.mock),
    claude: normalizePromptTemplateProviderSettings(
      record?.claude,
      defaultTranslationClientSettings.providers.claude
    ),
    deepseek: normalizePromptTemplateProviderSettings(
      record?.deepseek,
      defaultTranslationClientSettings.providers.deepseek
    ),
    minimax: normalizePromptTemplateProviderSettings(
      record?.minimax,
      defaultTranslationClientSettings.providers.minimax
    ),
    gemini: normalizeGeminiSettings(record?.gemini),
    google: normalizeGoogleSettings(record?.google),
    tencent: normalizeTencentSettings(record?.tencent),
    tongyi: normalizePromptTemplateProviderSettings(
      record?.tongyi,
      defaultTranslationClientSettings.providers.tongyi
    ),
    custom: normalizeCustomSettings(record?.custom)
  };
}

function normalizeSettings(candidate: unknown): TranslationClientSettings {
  const record = asRecord(candidate);

  if (record === null) {
    return cloneDefaultSettings();
  }

  const activeProviderId = pickString(record, 'activeProviderId');

  return {
    sourceLanguage: pickString(record, 'sourceLanguage') ?? defaultTranslationClientSettings.sourceLanguage,
    targetLanguage: pickString(record, 'targetLanguage') ?? defaultTranslationClientSettings.targetLanguage,
    activeProviderId: isProviderId(activeProviderId)
      ? activeProviderId
      : defaultTranslationClientSettings.activeProviderId,
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
      pickBoolean(record, 'enablePopupFallback') ?? defaultTranslationClientSettings.enablePopupFallback,
    providers: normalizeProviders(record.providers)
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
      return cloneDefaultSettings();
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
