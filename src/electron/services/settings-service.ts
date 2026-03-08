import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import type { RuntimeStatus } from '../../shared/types/ipc';
import type { AppSettings } from '../../shared/types/settings';
import { normalizeAppSettings } from '../../shared/utils/settings-validation';

export interface SettingsService {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: unknown): Promise<AppSettings>;
  getRuntimeStatus(): Promise<RuntimeStatus>;
}

export interface CreateSettingsServiceOptions {
  settingsFilePath: string;
  platform?: string;
}

export function createSettingsService({
  settingsFilePath,
  platform = process.platform
}: CreateSettingsServiceOptions): SettingsService {
  async function getSettings(): Promise<AppSettings> {
    try {
      const fileContents = await readFile(settingsFilePath, 'utf-8');
      return normalizeAppSettings(JSON.parse(fileContents));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return normalizeAppSettings(DEFAULT_SETTINGS);
      }

      return normalizeAppSettings(DEFAULT_SETTINGS);
    }
  }

  async function saveSettings(settings: unknown): Promise<AppSettings> {
    const normalizedSettings = normalizeAppSettings(settings);

    await mkdir(path.dirname(settingsFilePath), { recursive: true });
    await writeFile(
      settingsFilePath,
      `${JSON.stringify(normalizedSettings, null, 2)}\n`,
      'utf-8'
    );

    return normalizedSettings;
  }

  async function getRuntimeStatus(): Promise<RuntimeStatus> {
    const settings = await getSettings();

    return {
      ready: true,
      platform,
      activeProvider: settings.provider.kind,
      registeredShortcuts: [
        settings.shortcuts.quickTranslate,
        settings.shortcuts.contextTranslate
      ],
      lastExecution: null
    };
  }

  return {
    getSettings,
    saveSettings,
    getRuntimeStatus
  };
}
