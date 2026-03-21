import { describe, expect, it, vi } from 'vitest';
import { releaseVisibleMainWindow, runWithReleasedMainWindow } from './window-focus-guard';

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

describe('runWithReleasedMainWindow', () => {
  it('releases the main window then executes the workflow', async () => {
    const hide = vi.fn();
    const wait = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn().mockResolvedValue('result');

    const result = await runWithReleasedMainWindow(
      {
        isDestroyed: () => false,
        isVisible: () => true,
        hide
      },
      execute,
      wait,
      120
    );

    expect(result).toBe('result');
    expect(hide).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(120);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('executes the workflow even when the main window is null', async () => {
    const execute = vi.fn().mockResolvedValue('result');

    const result = await runWithReleasedMainWindow(
      null,
      execute,
      vi.fn().mockResolvedValue(undefined)
    );

    expect(result).toBe('result');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does not hide when the main window is not visible', async () => {
    const hide = vi.fn();
    const wait = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn().mockResolvedValue('result');

    await runWithReleasedMainWindow(
      {
        isDestroyed: () => false,
        isVisible: () => false,
        hide
      },
      execute,
      wait
    );

    expect(hide).not.toHaveBeenCalled();
    expect(wait).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
