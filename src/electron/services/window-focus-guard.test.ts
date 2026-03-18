import { describe, expect, it, vi } from 'vitest';
import { releaseVisibleMainWindow } from './window-focus-guard';

describe('releaseVisibleMainWindow', () => {
  it('hides the main window before running a global workflow when it is visible', async () => {
    const hide = vi.fn();
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      releaseVisibleMainWindow(
        {
          isDestroyed: () => false,
          isVisible: () => true,
          hide
        },
        wait,
        250
      )
    ).resolves.toBe(true);

    expect(hide).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(250);
  });

  it('does nothing when the main window is not visible', async () => {
    const hide = vi.fn();
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      releaseVisibleMainWindow(
        {
          isDestroyed: () => false,
          isVisible: () => false,
          hide
        },
        wait,
        250
      )
    ).resolves.toBe(false);

    expect(hide).not.toHaveBeenCalled();
    expect(wait).not.toHaveBeenCalled();
  });
});
