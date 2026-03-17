import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RuntimeStatusPanel } from './runtime-status-panel';

describe('RuntimeStatusPanel', () => {
  it('shows helper diagnostics alongside runtime status details', () => {
    const html = renderToStaticMarkup(
      <RuntimeStatusPanel
        electronInfo={{
          electron: '40.8.0',
          node: '24.14.0',
          chrome: '144.0.7559.236',
          platform: 'win32'
        }}
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
