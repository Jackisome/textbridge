import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { AppSettings } from '../../shared/types/settings';
import { registerSettingsIpc } from './register-settings-ipc';

const { ipcMainMock } = vi.hoisted(() => ({
  ipcMainMock: {
    removeHandler: vi.fn(),
    handle: vi.fn()
  }
}));

vi.mock('electron', () => ({
  ipcMain: ipcMainMock
}));

describe('registerSettingsIpc', () => {
  beforeEach(() => {
    ipcMainMock.removeHandler.mockClear();
    ipcMainMock.handle.mockClear();
  });

  it('invokes onSettingsSaved after persisting settings', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const savedSettings = {
      sourceLanguage: 'auto'
    } as AppSettings;
    const onSettingsSaved = vi.fn();

    ipcMainMock.handle.mockImplementation((channel, handler) => {
      handlers.set(channel, handler);
    });

    registerSettingsIpc({
      settingsService: {
        getSettings: vi.fn(),
        saveSettings: vi.fn().mockResolvedValue(savedSettings)
      } as never,
      runtimeStatusProvider: {
        getRuntimeStatus: vi.fn()
      },
      onSettingsSaved
    });

    const saveHandler = handlers.get(IPC_CHANNELS.settings.save);
    expect(saveHandler).toBeTypeOf('function');

    const result = await saveHandler?.({}, savedSettings);

    expect(result).toEqual(savedSettings);
    expect(onSettingsSaved).toHaveBeenCalledWith(savedSettings);
  });
});
