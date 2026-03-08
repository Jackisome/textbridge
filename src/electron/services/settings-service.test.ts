// @vitest-environment node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import { createSettingsService } from './settings-service';

const tempDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'textbridge-settings-'));

  tempDirectories.push(directory);

  return directory;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      fs.rm(directory, {
        force: true,
        recursive: true
      })
    )
  );
});

describe('createSettingsService', () => {
  it('returns default settings when config file does not exist', async () => {
    const tempDirectory = await createTempDirectory();
    const service = createSettingsService(path.join(tempDirectory, 'settings.json'));

    const settings = await service.loadSettings();

    expect(settings).toEqual(defaultTranslationClientSettings);
    expect(settings.activeProviderId).toBe('mock');
    expect(settings.providers.claude.apiKey).toBe('');
    expect(settings.providers.tencent.region).toBe('ap-beijing');
  });

  it('persists settings to disk and reads them back', async () => {
    const tempDirectory = await createTempDirectory();
    const filePath = path.join(tempDirectory, 'nested', 'settings.json');
    const service = createSettingsService(filePath);
    const nextSettings = {
      ...defaultTranslationClientSettings,
      activeProviderId: 'claude' as const,
      targetLanguage: 'en',
      quickTranslateShortcut: 'CommandOrControl+Alt+J',
      enablePopupFallback: false,
      providers: {
        ...defaultTranslationClientSettings.providers,
        claude: {
          ...defaultTranslationClientSettings.providers.claude,
          apiKey: 'test-key'
        }
      }
    };

    await service.saveSettings(nextSettings);

    await expect(service.loadSettings()).resolves.toEqual(nextSettings);

    const savedFileContent = await fs.readFile(filePath, 'utf8');

    expect(JSON.parse(savedFileContent)).toEqual(nextSettings);
  });

  it('falls back to default settings when config content is invalid', async () => {
    const tempDirectory = await createTempDirectory();
    const filePath = path.join(tempDirectory, 'settings.json');

    await fs.writeFile(filePath, '{"targetLanguage":1}', 'utf8');

    const service = createSettingsService(filePath);

    await expect(service.loadSettings()).resolves.toEqual(defaultTranslationClientSettings);
  });

  it('preserves nested provider configuration updates', async () => {
    const tempDirectory = await createTempDirectory();
    const filePath = path.join(tempDirectory, 'settings.json');
    const service = createSettingsService(filePath);

    await service.saveSettings({
      ...defaultTranslationClientSettings,
      activeProviderId: 'claude',
      providers: {
        ...defaultTranslationClientSettings.providers,
        claude: {
          ...defaultTranslationClientSettings.providers.claude,
          apiKey: 'test-key'
        }
      }
    });

    const settings = await service.loadSettings();

    expect(settings.activeProviderId).toBe('claude');
    expect(settings.providers.claude.apiKey).toBe('test-key');
  });
});
