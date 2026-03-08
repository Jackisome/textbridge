import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { defaultTranslationClientSettings } from '../../shared/constants/default-settings';
import { ProviderConfigPanel } from './provider-config-panel';

describe('ProviderConfigPanel', () => {
  it('renders tencent credential inputs', () => {
    render(
      <ProviderConfigPanel
        settings={{
          ...defaultTranslationClientSettings,
          activeProviderId: 'tencent'
        }}
        onProviderSettingsChange={() => {}}
      />
    );

    expect(screen.getByLabelText('SecretId')).not.toBeNull();
    expect(screen.getByLabelText('SecretKey')).not.toBeNull();
    expect(screen.getByLabelText('Region')).not.toBeNull();
  });

  it('renders google settings without model or api key fields', () => {
    render(
      <ProviderConfigPanel
        settings={{
          ...defaultTranslationClientSettings,
          activeProviderId: 'google'
        }}
        onProviderSettingsChange={() => {}}
      />
    );

    expect(screen.getByLabelText('Base URL')).not.toBeNull();
    expect(screen.queryByLabelText('API Key')).toBeNull();
    expect(screen.queryByLabelText('Model')).toBeNull();
  });
});
