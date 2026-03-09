import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_SETTINGS } from '../../shared/constants/default-settings';
import type { RuntimeStatus } from '../../shared/types/ipc';
import { SettingsPage } from './settings-page';

const runtimeStatus: RuntimeStatus = {
  ready: true,
  platform: 'win32',
  activeProvider: 'mock',
  registeredShortcuts: ['CommandOrControl+Shift+1', 'CommandOrControl+Shift+2'],
  helperState: 'ready',
  helperLastErrorCode: null,
  helperPid: 4321,
  lastExecution: null,
  recentExecutions: []
};

describe('SettingsPage', () => {
  it('renders a settings shell with navigation, editable fields, and save actions', () => {
    const markup = renderToStaticMarkup(
      <SettingsPage
        electronInfo={{
          electron: '40.8.0',
          node: '24.14.0',
          chrome: '144.0.7559.236',
          platform: 'win32'
        }}
        runtimeStatus={runtimeStatus}
        draftSettings={DEFAULT_SETTINGS}
        isSaving={false}
        saveMessage={null}
        onSave={() => {}}
        onReset={() => {}}
        onStringFieldChange={() => {}}
        onBooleanFieldChange={() => {}}
        onNumberFieldChange={() => {}}
        onProviderKindChange={() => {}}
        onOutputModeChange={() => {}}
        onCaptureMethodChange={() => {}}
      />
    );

    expect(markup).toContain('设置');
    expect(markup).toContain('常规');
    expect(markup).toContain('翻译设置');
    expect(markup).toContain('快捷键');
    expect(markup).toContain('保存更改');
    expect(markup).toContain('目标语言');
    expect(markup).toContain('Provider');
    expect(markup).toContain('托盘与启动');
    expect(markup).toContain('运行状态');
  });
});
