// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => ({
  handle: vi.fn()
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: electronMock.handle
  }
}));

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import { registerSettingsIpc } from './register-settings-ipc';

describe('registerSettingsIpc', () => {
  it('reloads shortcuts after save handler completes', async () => {
    electronMock.handle.mockReset();

    const loadSettings = vi.fn().mockResolvedValue(defaultTranslationClientSettings);
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    const onAfterSave = vi.fn();

    registerSettingsIpc(
      {
        loadSettings,
        saveSettings
      },
      { onAfterSave }
    );

    const saveHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === 'settings:save'
    )?.[1];

    expect(saveHandler).toBeTypeOf('function');

    await saveHandler?.({}, defaultTranslationClientSettings);

    expect(saveSettings).toHaveBeenCalledWith(defaultTranslationClientSettings);
    expect(onAfterSave).toHaveBeenCalledWith(defaultTranslationClientSettings);
  });
});
