import { useState } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import type { TranslationClientSettings } from '../types/settings';
import { SettingsPage } from './settings-page';

function SettingsPageHarness() {
  const [settings, setSettings] = useState<TranslationClientSettings>(defaultTranslationClientSettings);

  return (
    <SettingsPage
      electronInfo={{
        chrome: '144',
        electron: '40',
        node: '24',
        platform: 'win32'
      }}
      settings={settings}
      isDirty={false}
      isLoading={false}
      isSaving={false}
      saveMessage={null}
      onSave={() => {}}
      onReset={() => {}}
      onSettingChange={(key, value) => {
        setSettings((previous) => ({
          ...previous,
          [key]: value
        }));
      }}
      onActiveProviderChange={(providerId) => {
        setSettings((previous) => ({
          ...previous,
          activeProviderId: providerId
        }));
      }}
      onProviderSettingsChange={(providerId, nextSettings) => {
        setSettings((previous) => ({
          ...previous,
          providers: {
            ...previous.providers,
            [providerId]: nextSettings
          }
        }));
      }}
    />
  );
}

describe('SettingsPage provider workspace', () => {
  it('shows Claude credential fields without Tencent secrets', async () => {
    const user = userEvent.setup();

    render(<SettingsPageHarness />);

    await user.click(screen.getByRole('button', { name: /Anthropic Claude/i }));

    expect(screen.getByLabelText('API Key')).not.toBeNull();
    expect(screen.queryByLabelText('SecretId')).toBeNull();
  });

  it('shows Tencent specific secret fields', async () => {
    const user = userEvent.setup();

    render(<SettingsPageHarness />);

    await user.click(screen.getByRole('button', { name: /腾讯云机器翻译/i }));

    expect(screen.getByLabelText('SecretId')).not.toBeNull();
    expect(screen.getByLabelText('SecretKey')).not.toBeNull();
  });

  it('hides api key fields for Google translation', async () => {
    const user = userEvent.setup();

    render(<SettingsPageHarness />);

    await user.click(screen.getByRole('button', { name: /Google 机器翻译接口/i }));

    expect(screen.queryByLabelText('API Key')).toBeNull();
  });
});
