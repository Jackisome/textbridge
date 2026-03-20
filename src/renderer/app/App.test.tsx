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
    window.history.pushState({}, '', '/');
    window.textBridgeContracts = undefined;
  });

  it('routes the context popup through the prompt session api', async () => {
    const getContextPromptSession = vi.fn().mockResolvedValue({
      sourceText: 'Real prompt session source text',
      anchor: { kind: 'cursor' }
    });

    window.history.pushState({}, '', '/?view=context-popup');
    window.textBridgeContracts = {
      draftRequest: {
        text: 'Stale draft request text',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        outputMode: 'replace-original'
      },
      lastExecution: null,
      settingsSnapshot: null,
      contextPromptSession: null
    };
    window.textBridge = {
      getSettings: vi.fn().mockResolvedValue(createSettings()),
      saveSettings: vi.fn().mockResolvedValue(createSettings()),
      getRuntimeStatus: vi.fn().mockResolvedValue({
        ready: true,
        platform: 'win32',
        activeProvider: 'mock',
        registeredShortcuts: [],
        helperState: 'idle',
        helperLastErrorCode: null,
        helperPid: null,
        lastExecution: null,
        recentExecutions: []
      }),
      getContextPromptSession,
      submitContextPrompt: vi.fn().mockResolvedValue(undefined),
      cancelContextPrompt: vi.fn().mockResolvedValue(undefined)
    };

    render(<App />);

    await waitFor(() => {
      expect(getContextPromptSession).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Real prompt session source text')).not.toBeNull();
    expect(screen.queryByText('Stale draft request text')).toBeNull();
  });

  it('loads settings through the preload api on startup', async () => {
    const getSettings = vi
      .fn<() => Promise<TranslationClientSettings>>()
      .mockResolvedValue(createSettings({ targetLanguage: 'en' }));
    const saveSettings = vi
      .fn<(settings: TranslationClientSettings) => Promise<TranslationClientSettings>>()
      .mockImplementation(async (settings) => settings);
    const getRuntimeStatus = vi.fn().mockResolvedValue({
      ready: true,
      platform: 'win32',
      activeProvider: 'mock',
      registeredShortcuts: [],
      helperState: 'idle',
      helperLastErrorCode: null,
      helperPid: null,
      lastExecution: null,
      recentExecutions: []
    });

    window.textBridge = {
      getSettings,
      saveSettings,
      getRuntimeStatus,
      getContextPromptSession: vi.fn().mockResolvedValue(null),
      submitContextPrompt: vi.fn().mockResolvedValue(undefined),
      cancelContextPrompt: vi.fn().mockResolvedValue(undefined)
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
    const saveSettings = vi
      .fn<(settings: TranslationClientSettings) => Promise<TranslationClientSettings>>()
      .mockImplementation(async (settings) => settings);
    const getRuntimeStatus = vi.fn().mockResolvedValue({
      ready: true,
      platform: 'win32',
      activeProvider: 'mock',
      registeredShortcuts: [],
      helperState: 'idle',
      helperLastErrorCode: null,
      helperPid: null,
      lastExecution: null,
      recentExecutions: []
    });

    window.textBridge = {
      getSettings,
      saveSettings,
      getRuntimeStatus,
      getContextPromptSession: vi.fn().mockResolvedValue(null),
      submitContextPrompt: vi.fn().mockResolvedValue(undefined),
      cancelContextPrompt: vi.fn().mockResolvedValue(undefined)
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
