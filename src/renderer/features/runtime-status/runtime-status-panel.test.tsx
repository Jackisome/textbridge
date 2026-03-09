import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RuntimeStatusPanel } from './runtime-status-panel';

describe('RuntimeStatusPanel', () => {
  it('shows helper diagnostics alongside runtime status details', () => {
    const html = renderToStaticMarkup(
      <RuntimeStatusPanel
        runtimeStatus={{
          ready: true,
          platform: 'win32',
          activeProvider: 'mock',
          registeredShortcuts: ['Ctrl+Alt+T'],
          helperState: 'degraded',
          helperLastErrorCode: 'PLATFORM_BRIDGE_TIMEOUT',
          helperPid: 5124,
          lastExecution: null,
          recentExecutions: []
        }}
      />
    );

    expect(html).toContain('Helper');
    expect(html).toContain('degraded');
    expect(html).toContain('PLATFORM_BRIDGE_TIMEOUT');
    expect(html).toContain('5124');
  });
});
