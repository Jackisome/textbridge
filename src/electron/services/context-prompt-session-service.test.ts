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

  it('rejects repeated open calls while a prompt session is active', async () => {
    const service = createContextPromptSessionService();
    const pending = service.open({
      sourceText: 'first',
      anchor: { kind: 'cursor' }
    });

    await expect(
      service.open({
        sourceText: 'second',
        anchor: { kind: 'window-rect' }
      })
    ).rejects.toMatchObject({
      status: 'already-active'
    });

    service.submit({
      instructions: 'Finish the first session.'
    });

    await expect(pending).resolves.toEqual({
      status: 'submitted',
      instructions: 'Finish the first session.'
    });
  });

  it('treats submit, cancel, and clear after settle as no-op', async () => {
    const service = createContextPromptSessionService();
    const pending = service.open({
      sourceText: 'settle me',
      anchor: { kind: 'cursor' }
    });

    service.submit({
      instructions: 'Use plain language.'
    });

    await expect(pending).resolves.toEqual({
      status: 'submitted',
      instructions: 'Use plain language.'
    });

    expect(() =>
      service.submit({
        instructions: 'ignored'
      })
    ).not.toThrow();
    expect(() => service.cancel()).not.toThrow();
    expect(() => service.clear()).not.toThrow();
    expect(service.getActive()).toBeNull();
  });

  it('returns a defensive copy from getActive', () => {
    const service = createContextPromptSessionService();

    service.open({
      sourceText: 'mutable',
      anchor: {
        kind: 'selection-rect',
        bounds: {
          x: 10,
          y: 20,
          width: 30,
          height: 40
        },
        displayId: 'display-1'
      }
    });

    const active = service.getActive();

    expect(active).not.toBeNull();

    if (!active) {
      return;
    }

    active.sourceText = 'changed';
    active.anchor.kind = 'cursor';
    if (active.anchor.bounds) {
      active.anchor.bounds.x = 999;
    }

    expect(service.getActive()).toEqual({
      sourceText: 'mutable',
      anchor: {
        kind: 'selection-rect',
        bounds: {
          x: 10,
          y: 20,
          width: 30,
          height: 40
        },
        displayId: 'display-1'
      }
    });
  });

  it('clear resolves the active prompt session as cleared', async () => {
    const service = createContextPromptSessionService();
    const pending = service.open({
      sourceText: 'clear me',
      anchor: { kind: 'cursor' }
    });

    service.clear();

    await expect(pending).resolves.toEqual({
      status: 'cleared'
    });

    expect(service.getActive()).toBeNull();
  });
});
