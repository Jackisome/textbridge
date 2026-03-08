import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import { createSettingsService } from './settings-service';

describe('createSettingsService', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map((directoryPath) =>
        rm(directoryPath, { recursive: true, force: true })
      )
    );
  });

  async function createService() {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'textbridge-settings-'));
    tempDirectories.push(tempDirectory);

    return createSettingsService({
      settingsFilePath: path.join(tempDirectory, 'settings.json')
    });
  }

  it('returns default settings when the file does not exist', async () => {
    const settingsService = await createService();

    await expect(settingsService.getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('persists settings and reads them back', async () => {
    const settingsService = await createService();
    const savedSettings = {
      ...DEFAULT_SETTINGS,
      targetLanguage: 'en',
      provider: {
        ...DEFAULT_SETTINGS.provider,
        kind: 'http' as const,
        endpoint: 'https://api.example.com/translate'
      }
    };

    await expect(settingsService.saveSettings(savedSettings)).resolves.toEqual(savedSettings);
    await expect(settingsService.getSettings()).resolves.toEqual(savedSettings);
  });
});
