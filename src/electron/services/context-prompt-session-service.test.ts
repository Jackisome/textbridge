import { describe, expect, it } from 'vitest';

import { createContextPromptSessionService } from './context-prompt-session-service';

describe('createContextPromptSessionService', () => {
  it('keeps a single active prompt session and resolves submit', async () => {
    const service = createContextPromptSessionService();
    const pending = service.open({
      sourceText: 'world',
      anchor: { kind: 'cursor' }
    });

    expect(service.getActive()).toEqual({
      sourceText: 'world',
      anchor: { kind: 'cursor' }
    });

    service.submit({
      instructions: 'Use concise business English.'
    });

    await expect(pending).resolves.toEqual({
      status: 'submitted',
      instructions: 'Use concise business English.'
    });

    expect(service.getActive()).toBeNull();
  });

  it('resolves cancel and clears the active prompt session', async () => {
    const service = createContextPromptSessionService();
    const pending = service.open({
      sourceText: 'hello',
      anchor: { kind: 'unknown' }
    });

    service.cancel();

    await expect(pending).resolves.toEqual({
      status: 'cancelled'
    });

    expect(service.getActive()).toBeNull();
  });

  it('clear removes the active prompt session without resolving it', () => {
    const service = createContextPromptSessionService();

    service.open({
      sourceText: 'clear me',
      anchor: { kind: 'cursor' }
    });

    service.clear();

    expect(service.getActive()).toBeNull();
  });
});
