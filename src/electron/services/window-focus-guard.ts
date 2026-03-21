export interface MainWindowVisibilityController {
  isDestroyed(): boolean;
  isVisible(): boolean;
  hide(): void;
}

export async function releaseVisibleMainWindow(
  mainWindow: MainWindowVisibilityController | null,
  wait: (ms: number) => Promise<void>,
  delayMs = 250
): Promise<boolean> {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
    return false;
  }

  mainWindow.hide();
  await wait(delayMs);
  return true;
}

export async function runWithReleasedMainWindow<T>(
  mainWindow: MainWindowVisibilityController | null,
  execute: () => Promise<T>,
  wait: (ms: number) => Promise<void>,
  delayMs = 120
): Promise<T> {
  await releaseVisibleMainWindow(mainWindow, wait, delayMs);
  return execute();
}
