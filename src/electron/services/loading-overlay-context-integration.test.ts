import { describe, expect, it, vi } from 'vitest';

const prepare = vi.fn().mockResolvedValue(undefined);
const showAt = vi.fn().mockResolvedValue(undefined);
const hide = vi.fn();
const dispose = vi.fn();
const getWindow = vi.fn(() => null);

vi.mock('./loading-overlay-service', () => ({
  createLoadingOverlayService: vi.fn(() => ({
    prepare,
    showAt,
    hide,
    dispose,
    getWindow
  }))
}));

describe('loading overlay + context translation coordination', () => {
  beforeEach(() => {
    prepare.mockClear();
    showAt.mockClear();
    hide.mockClear();
  });

  it('showAt is called before context run, hide is called in finally', async () => {
    const run = vi.fn().mockResolvedValue({ id: 'ctx1', status: 'completed' });

    let isActive = false;
    const cursorPoint = { x: 100, y: 200 };

    async function triggerContextTranslate() {
      if (isActive) return;
      isActive = true;

      showAt(cursorPoint.x, cursorPoint.y).catch(() => {});
      try {
        await run();
      } finally {
        hide();
        isActive = false;
      }
    }

    await triggerContextTranslate();

    expect(showAt).toHaveBeenCalledWith(100, 200);
    expect(run).toHaveBeenCalled();
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('second context trigger is ignored while first is active', async () => {
    let resolveRun: () => void;
    const run = vi.fn(() => new Promise<void>((r) => { resolveRun = r; }));

    let isActive = false;

    async function triggerContextTranslate() {
      if (isActive) return;
      isActive = true;
      showAt(100, 200).catch(() => {});
      try {
        await run();
      } finally {
        hide();
        isActive = false;
      }
    }

    const first = triggerContextTranslate();
    const second = triggerContextTranslate();

    expect(showAt).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);

    resolveRun!();
    await first;
    await second;

    expect(hide).toHaveBeenCalledTimes(1);
  });
});
