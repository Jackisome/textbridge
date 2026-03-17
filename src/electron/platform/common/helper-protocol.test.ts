import { describe, expect, it } from 'vitest';
import { isHelperResponse, toHelperRequest } from './helper-protocol';

describe('helper protocol', () => {
  it('creates a request with id, kind, timestamp and payload', () => {
    const request = toHelperRequest('health-check', {});

    expect(request.kind).toBe('health-check');
    expect(request.id).toMatch(/^req-/);
    expect(request.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(request.payload).toEqual({});
  });

  it('accepts only valid helper responses', () => {
    expect(
      isHelperResponse({
        id: 'req-1',
        kind: 'health-check',
        ok: true,
        payload: {},
        error: null
      })
    ).toBe(true);

    expect(
      isHelperResponse({
        id: 'req-2',
        kind: 'capture-text',
        ok: false,
        payload: {},
        error: {
          code: 'CAPTURE_FAILED',
          message: 'Failed to capture text.'
        }
      })
    ).toBe(true);

    expect(
      isHelperResponse({
        id: 'req-2b',
        kind: 'write-text',
        ok: true,
        payload: null,
        error: null
      })
    ).toBe(false);

    expect(
      isHelperResponse({
        id: 'req-2c',
        kind: 'clipboard-write',
        ok: true,
        payload: [],
        error: null
      })
    ).toBe(false);

    expect(isHelperResponse({ kind: 'health-check' })).toBe(false);
    expect(
      isHelperResponse({
        id: 'req-3',
        kind: 'health-check',
        ok: true,
        payload: {}
      })
    ).toBe(false);
  });
});
