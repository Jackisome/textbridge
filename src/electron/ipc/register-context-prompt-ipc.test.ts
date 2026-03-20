// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn()
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: electronMock.handle,
    removeHandler: electronMock.removeHandler
  }
}));

import { registerContextPromptIpc } from './register-context-prompt-ipc';

describe('registerContextPromptIpc', () => {
  it('routes getSession submit and cancel to the prompt session service', async () => {
    electronMock.handle.mockReset();
    electronMock.removeHandler.mockReset();

    const promptSessionService = {
      getActive: vi.fn().mockReturnValue({
        sourceText: 'hello',
        anchor: { kind: 'cursor' as const }
      }),
      submit: vi.fn(),
      cancel: vi.fn()
    };
    const promptWindowService = {
      close: vi.fn()
    };

    registerContextPromptIpc({
      promptSessionService,
      promptWindowService
    });

    const getSessionHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === 'contextPrompt:getSession'
    )?.[1];
    const submitHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === 'contextPrompt:submit'
    )?.[1];
    const cancelHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === 'contextPrompt:cancel'
    )?.[1];

    expect(getSessionHandler).toBeTypeOf('function');
    expect(submitHandler).toBeTypeOf('function');
    expect(cancelHandler).toBeTypeOf('function');

    await expect(getSessionHandler?.()).resolves.toEqual({
      sourceText: 'hello',
      anchor: { kind: 'cursor' }
    });

    await submitHandler?.({}, { instructions: 'Use concise language.' });
    expect(promptWindowService.close).toHaveBeenCalledTimes(1);
    await cancelHandler?.();
    expect(promptWindowService.close).toHaveBeenCalledTimes(2);

    expect(promptSessionService.getActive).toHaveBeenCalledTimes(1);
    expect(promptSessionService.submit).toHaveBeenCalledWith({
      instructions: 'Use concise language.'
    });
    expect(promptSessionService.cancel).toHaveBeenCalledTimes(1);
  });
});
