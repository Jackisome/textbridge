import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import type { TranslationClientSettings } from '../../shared/types/settings';
import App from './App';

function createSettings(
  overrides: Partial<TranslationClientSettings> = {}
): TranslationClientSettings {
  return {
    ...defaultTranslationClientSettings,
    ...overrides
  };
}

describe('App settings persistence', () => {
  beforeEach(() => {
    window.electronInfo = {
      chrome: '144',
      electron: '40',
      node: '24',
      platform: 'win32'
    };
  });

  it('loads settings through the preload api on startup', async () => {
    const getSettings = vi
      .fn<() => Promise<TranslationClientSettings>>()
      .mockResolvedValue(createSettings({ targetLanguage: 'en' }));
    const saveSettings = vi.fn<(settings: TranslationClientSettings) => Promise<void>>().mockResolvedValue();

    window.textBridge = {
      getSettings,
      saveSettings
    };

    render(<App />);

    await waitFor(() => {
      expect(getSettings).toHaveBeenCalledTimes(1);
    });

    const selectElements = await screen.findAllByRole('combobox');

    expect((selectElements[1] as HTMLSelectElement).value).toBe('en');
  });

  it('saves updated settings through the preload api', async () => {
    const user = userEvent.setup();
    const loadedSettings = createSettings({
      activeProviderId: 'claude',
      quickTranslateShortcut: 'CommandOrControl+Shift+L'
    });
    const getSettings = vi
      .fn<() => Promise<TranslationClientSettings>>()
      .mockResolvedValue(loadedSettings);
    const saveSettings = vi.fn<(settings: TranslationClientSettings) => Promise<void>>().mockResolvedValue();

    window.textBridge = {
      getSettings,
      saveSettings
    };

    render(<App />);

    const shortcutButton = await screen.findByRole('button', { name: '快速翻译快捷键' });

    await user.click(shortcutButton);
    fireEvent.keyDown(shortcutButton, { key: 'j', ctrlKey: true, altKey: true });
    await user.click(screen.getByRole('button', { name: '保存更改' }));

    await waitFor(() => {
      expect(getSettings).toHaveBeenCalled();
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          activeProviderId: 'claude',
          quickTranslateShortcut: 'CommandOrControl+Alt+J'
        })
      );
    });
  });
});
