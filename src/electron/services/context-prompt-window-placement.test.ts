import { describe, expect, it } from 'vitest';
import { resolveContextPromptWindowBounds, type ResolveContextPromptWindowBoundsOptions } from './context-prompt-window-placement';

function opts(overrides: Partial<ResolveContextPromptWindowBoundsOptions>): ResolveContextPromptWindowBoundsOptions {
  return {
    anchor: { kind: 'unknown' },
    popupSize: { width: 480, height: 360 },
    workArea: { x: 0, y: 0, width: 1280, height: 720 },
    ...overrides
  };
}

describe('resolveContextPromptWindowBounds', () => {
  it('places the popup directly below a control-rect anchor', () => {
    const result = resolveContextPromptWindowBounds(opts({
      anchor: {
        kind: 'control-rect',
        bounds: { x: 100, y: 80, width: 400, height: 40 }
      },
      popupSize: { width: 480, height: 360 },
      workArea: { x: 0, y: 0, width: 1280, height: 720 }
    }));

    // y = anchor.y + anchor.height = 80 + 40 = 120
    expect(result).toEqual({ x: 100, y: 120, width: 480, height: 360 });
  });

  it('flips popup above the anchor when there is not enough room below', () => {
    const result = resolveContextPromptWindowBounds(opts({
      anchor: {
        kind: 'control-rect',
        bounds: { x: 100, y: 600, width: 400, height: 40 }
      },
      popupSize: { width: 480, height: 360 },
      workArea: { x: 0, y: 0, width: 1280, height: 720 }
    }));

    // y + popup exceeds bottom of workArea, so flip above: 600 - 360 = 240
    expect(result.y).toBe(240);
    expect(result.x).toBe(100);
  });

  it('clamps x to work area when anchor is near the right edge', () => {
    const result = resolveContextPromptWindowBounds(opts({
      anchor: {
        kind: 'selection-rect',
        bounds: { x: 900, y: 100, width: 300, height: 30 }
      },
      popupSize: { width: 480, height: 360 },
      workArea: { x: 0, y: 0, width: 1280, height: 720 }
    }));

    // x = 900 + 300 = 1200, but 1200 + 480 > 1280, so clamp to 800
    expect(result.x).toBe(800);
    expect(result.y).toBe(130);
  });

  it('places popup near cursor position with small offset', () => {
    const result = resolveContextPromptWindowBounds(opts({
      anchor: { kind: 'cursor' },
      cursorPoint: { x: 640, y: 400 },
      popupSize: { width: 480, height: 360 },
      workArea: { x: 0, y: 0, width: 1280, height: 720 }
    }));

    // cursor → near the point, offset slightly
    expect(result.width).toBe(480);
    expect(result.height).toBe(360);
    // Should be near cursor but clamped
    expect(result.x).toBeLessThanOrEqual(1280 - 480);
    expect(result.y).toBeLessThanOrEqual(720 - 360);
  });

  it('centers in work area for unknown anchor kind', () => {
    const result = resolveContextPromptWindowBounds(opts({
      anchor: { kind: 'unknown' },
      popupSize: { width: 480, height: 360 },
      workArea: { x: 0, y: 0, width: 1280, height: 720 }
    }));

    // centered: x = (1280 - 480) / 2 = 400, y = (720 - 360) / 2 = 180
    expect(result).toEqual({ x: 400, y: 180, width: 480, height: 360 });
  });

  it('clamps popup height to work area when popup is taller than work area', () => {
    const result = resolveContextPromptWindowBounds(opts({
      anchor: { kind: 'control-rect', bounds: { x: 100, y: 50, width: 200, height: 30 } },
      popupSize: { width: 480, height: 360 },
      workArea: { x: 0, y: 0, width: 1920, height: 600 }
    }));

    expect(result.height).toBeLessThanOrEqual(600);
  });
});
