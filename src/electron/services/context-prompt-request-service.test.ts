import { describe, expect, it, vi } from 'vitest';

import { createContextPromptSessionService } from './context-prompt-session-service';
import { createContextPromptRequestService } from './context-prompt-request-service';

function createPromptWindowHandle() {
  const listeners = new Map<string, () => void>();

  return {
    handle: {
      once: vi.fn((event: string, listener: () => void) => {
        listeners.set(event, listener);
      }),
      removeListener: vi.fn((event: string, listener: () => void) => {
        if (listeners.get(event) === listener) {
          listeners.delete(event);
        }
      })
    },
    emitClosed() {
      listeners.get('closed')?.();
    }
  };
}

describe('createContextPromptRequestService', () => {
  it('opens a session and returns submitted instructions', async () => {
    const promptSessionService = createContextPromptSessionService();
    const promptWindow = createPromptWindowHandle();
    const anchor = {
      kind: 'control-rect' as const,
      bounds: {
        x: 24,
        y: 32,
        width: 240,
        height: 48
      }
    };
    const promptWindowService = {
      open: vi.fn().mockResolvedValue(promptWindow.handle),
      close: vi.fn(),
      getWindow: vi.fn().mockReturnValue(null)
    };
    const requestService = createContextPromptRequestService({
      promptSessionService,
      promptWindowService
    });

    const pending = requestService.requestContextInstructions('Hello world', anchor);

    expect(promptSessionService.getActive()).toEqual({
      sourceText: 'Hello world',
      anchor
    });
    expect(promptWindowService.open).toHaveBeenCalledTimes(1);

    promptSessionService.submit({
      instructions: 'Use concise business English.'
    });

    await expect(pending).resolves.toBe('Use concise business English.');
  });

  it('returns null and clears the session when the popup closes abnormally', async () => {
    const promptSessionService = createContextPromptSessionService();
    const promptWindow = createPromptWindowHandle();
    const promptWindowService = {
      open: vi.fn().mockResolvedValue(promptWindow.handle),
      close: vi.fn(),
      getWindow: vi.fn().mockReturnValue(null)
    };
    const requestService = createContextPromptRequestService({
      promptSessionService,
      promptWindowService
    });

    const pending = requestService.requestContextInstructions('Hello world');

    await Promise.resolve();
    promptWindow.emitClosed();

    await expect(pending).resolves.toBeNull();
    expect(promptSessionService.getActive()).toBeNull();
  });

  it('clears the session if popup open fails', async () => {
    const promptSessionService = createContextPromptSessionService();
    const promptWindowService = {
      open: vi.fn().mockRejectedValue(new Error('load failed')),
      close: vi.fn(),
      getWindow: vi.fn().mockReturnValue(null)
    };
    const requestService = createContextPromptRequestService({
      promptSessionService,
      promptWindowService
    });

    await expect(
      requestService.requestContextInstructions('Hello world')
    ).rejects.toThrow('load failed');

    expect(promptSessionService.getActive()).toBeNull();
  });

  it('brings the active popup forward without opening a second session', async () => {
    const promptSessionService = createContextPromptSessionService();
    const promptWindow = createPromptWindowHandle();
    const promptWindowService = {
      open: vi.fn().mockResolvedValue(promptWindow.handle),
      close: vi.fn(),
      getWindow: vi.fn().mockReturnValue(null)
    };
    const requestService = createContextPromptRequestService({
      promptSessionService,
      promptWindowService
    });

    const first = requestService.requestContextInstructions('Hello world');
    const second = requestService.requestContextInstructions('Hello again');

    expect(promptSessionService.getActive()).toEqual({
      sourceText: 'Hello world',
      anchor: { kind: 'unknown' }
    });
    expect(promptSessionService.open).toBeTypeOf('function');
    expect(promptWindowService.open).toHaveBeenCalledTimes(2);

    promptSessionService.submit({
      instructions: 'Use concise business English.'
    });

    await expect(first).resolves.toBe('Use concise business English.');
    await expect(second).resolves.toBe('Use concise business English.');
  });
});
