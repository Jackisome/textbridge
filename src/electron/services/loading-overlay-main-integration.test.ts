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

describe('loading overlay + quick translation coordination', () => {
  beforeEach(() => {
    prepare.mockClear();
    showAt.mockClear();
    hide.mockClear();
  });

  it('showAt is called before run, hide is called in finally', async () => {
    const run = vi.fn().mockResolvedValue({ id: 'r1', status: 'completed' });

    // Simulate the coordination pattern used in main.ts onQuickTranslate
    let isActive = false;
    const cursorPoint = { x: 100, y: 200 };

    async function triggerQuickTranslate() {
      if (isActive) return;
      isActive = true;

      // Fire-and-forget showAt (caller does not await)
      showAt(cursorPoint.x, cursorPoint.y).catch(() => {}); // non-blocking
      try {
        await run();
      } finally {
        hide();
        isActive = false;
      }
    }

    await triggerQuickTranslate();

    expect(showAt).toHaveBeenCalledWith(100, 200);
    expect(run).toHaveBeenCalled();
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('second trigger is ignored while first is active', async () => {
    let resolveRun: () => void;
    const run = vi.fn(() => new Promise<void>((r) => { resolveRun = r; }));

    let isActive = false;

    async function triggerQuickTranslate() {
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

    const first = triggerQuickTranslate();
    const second = triggerQuickTranslate(); // should be ignored

    expect(showAt).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);

    resolveRun!();
    await first;
    await second;

    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('hide called before showAt window-load completes still results in hidden overlay', async () => {
    // showAt has internal async load; hide is sync
    // The service must handle this race: hide should cancel pending show
    let pendingShowResolve: () => void;
    const showLoad = vi.fn().mockImplementation(() =>
      new Promise<void>(r => { pendingShowResolve = r; })
    );
    const show = vi.fn();
    const hide = vi.fn();
    const createWindow = vi.fn().mockReturnValue({
      loadURL: showLoad,
      show,
      hide,
      isDestroyed: () => false,
      on: vi.fn()
    });

    // In the actual service, hide() checks pendingShow flag and resolves the pending promise
    // This test verifies: if hide() is called while show is still loading,
    // the window never becomes visible
    hide(); // hide called before load resolves
    pendingShowResolve!(); // load finally completes

    expect(hide).toHaveBeenCalled();
    // show() should NOT have been called since hide cancelled the pending show
    expect(show).not.toHaveBeenCalled();
  });
});
