import { describe, expect, it } from 'vitest';
import { createMainWindowOptions } from './window-service';

describe('createMainWindowOptions', () => {
  it('disables sandbox so preload can resolve compiled shared modules', () => {
    const options = createMainWindowOptions({
      preloadPath: 'C:/tmp/preload.js'
    });

    expect(options.webPreferences?.sandbox).toBe(false);
    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
  });
});
