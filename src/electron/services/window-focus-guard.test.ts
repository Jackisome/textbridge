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
  it('hides a visible main window before executing a global workflow', async () => {
    const calls: string[] = [];

    await runWithReleasedMainWindow(
      {
        isDestroyed: () => false,
        isVisible: () => true,
        hide: () => calls.push('hide')
      },
      async () => {
        calls.push('execute');
      },
      async (ms) => {
        calls.push(`wait:${ms}`);
      },
      120
    );

    expect(calls).toEqual(['hide', 'wait:120', 'execute']);
  });

  it('does not hide when the main window is already hidden', async () => {
    const calls: string[] = [];

    await runWithReleasedMainWindow(
      {
        isDestroyed: () => false,
        isVisible: () => false,
        hide: () => calls.push('hide')
      },
      async () => {
        calls.push('execute');
      },
      async (ms) => {
        calls.push(`wait:${ms}`);
      },
      120
    );

    expect(calls).toEqual(['execute']);
  });

  it('does not hide when the main window is destroyed', async () => {
    const calls: string[] = [];

    await runWithReleasedMainWindow(
      {
        isDestroyed: () => true,
        isVisible: () => true,
        hide: () => calls.push('hide')
      },
      async () => {
        calls.push('execute');
      },
      async (ms) => {
        calls.push(`wait:${ms}`);
      },
      120
    );

    expect(calls).toEqual(['execute']);
  });
});
