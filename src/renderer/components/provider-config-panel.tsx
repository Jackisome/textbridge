import { providerMetadata } from '../../shared/constants/provider-metadata';
import type { ProviderId, ProviderSettingsMap, TranslationClientSettings } from '../types/settings';
import { SecretField } from './secret-field';

interface ProviderConfigPanelProps {
  settings: TranslationClientSettings;
  onProviderSettingsChange: (providerId: ProviderId, nextSettings: ProviderSettingsMap[ProviderId]) => void;
}

function renderTextField(
  label: string,
  value: string,
  onChange: (value: string) => void,
  options: {
    placeholder?: string;
    type?: 'text' | 'url';
    className?: string;
  } = {}
) {
  return (
    <label className={`field${options.className === undefined ? '' : ` ${options.className}`}`}>
      <span className="field-label">{label}</span>
      <input
        aria-label={label}
        type={options.type ?? 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={options.placeholder}
      />
    </label>
  );
}

function renderNumberField(
  label: string,
  value: number,
  onChange: (value: number) => void,
  options: {
    min?: number;
    step?: number;
  } = {}
) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        aria-label={label}
        type="number"
        min={options.min}
        step={options.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function renderTextareaField(
  label: string,
  value: string,
  onChange: (value: string) => void
) {
  return (
    <label className="field field--wide">
      <span className="field-label">{label}</span>
      <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} rows={4} />
    </label>
  );
}

function renderBaseUrlAndTimeout(
  baseUrl: string,
  timeoutMs: number,
  onBaseUrlChange: (value: string) => void,
  onTimeoutChange: (value: number) => void
) {
  return (
    <>
      {renderTextField('Base URL', baseUrl, onBaseUrlChange, {
        type: 'url',
        className: 'field--wide'
      })}
      {renderNumberField('Timeout (ms)', timeoutMs, onTimeoutChange, {
        min: 1000,
        step: 1000
      })}
    </>
  );
}

function renderPromptFields(
  systemPrompt: string,
  userPromptTemplate: string,
  onSystemPromptChange: (value: string) => void,
  onUserPromptTemplateChange: (value: string) => void
) {
  return (
    <>
      {renderTextareaField('System Prompt', systemPrompt, onSystemPromptChange)}
      {renderTextareaField('User Prompt Template', userPromptTemplate, onUserPromptTemplateChange)}
    </>
  );
}

export function ProviderConfigPanel({
  settings,
  onProviderSettingsChange
}: ProviderConfigPanelProps) {
  const { activeProviderId } = settings;
  const metadata = providerMetadata[activeProviderId];

  function updateSettings<Id extends ProviderId>(providerId: Id, nextSettings: ProviderSettingsMap[Id]) {
    onProviderSettingsChange(providerId, nextSettings);
  }

  return (
    <section className="provider-config-panel" aria-label="当前 Provider 配置">
      <header className="provider-config-panel__header">
        <div>
          <p className="card-kicker">当前 Provider 配置</p>
          <h3>{metadata.label} 配置</h3>
        </div>
        <p className="provider-config-panel__description">{metadata.description}</p>
      </header>

      <div className="field-grid">
        {activeProviderId === 'claude' ? (
          <>
            <SecretField
              label="API Key"
              value={settings.providers.claude.apiKey}
              placeholder="sk-ant-..."
              onChange={(value) =>
                updateSettings('claude', {
                  ...settings.providers.claude,
                  apiKey: value
                })
              }
            />
            {renderTextField('Model', settings.providers.claude.model, (value) =>
              updateSettings('claude', {
                ...settings.providers.claude,
                model: value
              })
            )}
            {renderBaseUrlAndTimeout(
              settings.providers.claude.baseUrl,
              settings.providers.claude.timeoutMs,
              (value) =>
                updateSettings('claude', {
                  ...settings.providers.claude,
                  baseUrl: value
                }),
              (value) =>
                updateSettings('claude', {
                  ...settings.providers.claude,
                  timeoutMs: value
                })
            )}
            {renderPromptFields(
              settings.providers.claude.systemPrompt,
              settings.providers.claude.userPromptTemplate,
              (value) =>
                updateSettings('claude', {
                  ...settings.providers.claude,
                  systemPrompt: value
                }),
              (value) =>
                updateSettings('claude', {
                  ...settings.providers.claude,
                  userPromptTemplate: value
                })
            )}
          </>
        ) : null}

        {activeProviderId === 'deepseek' ? (
          <>
            <SecretField
              label="API Key"
              value={settings.providers.deepseek.apiKey}
              placeholder="sk-..."
              onChange={(value) =>
                updateSettings('deepseek', {
                  ...settings.providers.deepseek,
                  apiKey: value
                })
              }
            />
            {renderTextField('Model', settings.providers.deepseek.model, (value) =>
              updateSettings('deepseek', {
                ...settings.providers.deepseek,
                model: value
              })
            )}
            {renderBaseUrlAndTimeout(
              settings.providers.deepseek.baseUrl,
              settings.providers.deepseek.timeoutMs,
              (value) =>
                updateSettings('deepseek', {
                  ...settings.providers.deepseek,
                  baseUrl: value
                }),
              (value) =>
                updateSettings('deepseek', {
                  ...settings.providers.deepseek,
                  timeoutMs: value
                })
            )}
            {renderPromptFields(
              settings.providers.deepseek.systemPrompt,
              settings.providers.deepseek.userPromptTemplate,
              (value) =>
                updateSettings('deepseek', {
                  ...settings.providers.deepseek,
                  systemPrompt: value
                }),
              (value) =>
                updateSettings('deepseek', {
                  ...settings.providers.deepseek,
                  userPromptTemplate: value
                })
            )}
          </>
        ) : null}

        {activeProviderId === 'minimax' ? (
          <>
            <SecretField
              label="API Key"
              value={settings.providers.minimax.apiKey}
              placeholder="minimax-..."
              onChange={(value) =>
                updateSettings('minimax', {
                  ...settings.providers.minimax,
                  apiKey: value
                })
              }
            />
            {renderTextField('Model', settings.providers.minimax.model, (value) =>
              updateSettings('minimax', {
                ...settings.providers.minimax,
                model: value
              })
            )}
            {renderBaseUrlAndTimeout(
              settings.providers.minimax.baseUrl,
              settings.providers.minimax.timeoutMs,
              (value) =>
                updateSettings('minimax', {
                  ...settings.providers.minimax,
                  baseUrl: value
                }),
              (value) =>
                updateSettings('minimax', {
                  ...settings.providers.minimax,
                  timeoutMs: value
                })
            )}
            {renderPromptFields(
              settings.providers.minimax.systemPrompt,
              settings.providers.minimax.userPromptTemplate,
              (value) =>
                updateSettings('minimax', {
                  ...settings.providers.minimax,
                  systemPrompt: value
                }),
              (value) =>
                updateSettings('minimax', {
                  ...settings.providers.minimax,
                  userPromptTemplate: value
                })
            )}
          </>
        ) : null}

        {activeProviderId === 'gemini' ? (
          <>
            <SecretField
              label="API Key"
              value={settings.providers.gemini.apiKey}
              placeholder="AIza..."
              onChange={(value) =>
                updateSettings('gemini', {
                  ...settings.providers.gemini,
                  apiKey: value
                })
              }
            />
            {renderTextField('Model', settings.providers.gemini.model, (value) =>
              updateSettings('gemini', {
                ...settings.providers.gemini,
                model: value
              })
            )}
            {renderBaseUrlAndTimeout(
              settings.providers.gemini.baseUrl,
              settings.providers.gemini.timeoutMs,
              (value) =>
                updateSettings('gemini', {
                  ...settings.providers.gemini,
                  baseUrl: value
                }),
              (value) =>
                updateSettings('gemini', {
                  ...settings.providers.gemini,
                  timeoutMs: value
                })
            )}
            {renderTextareaField(
              'User Prompt Template',
              settings.providers.gemini.userPromptTemplate,
              (value) =>
                updateSettings('gemini', {
                  ...settings.providers.gemini,
                  userPromptTemplate: value
                })
            )}
          </>
        ) : null}

        {activeProviderId === 'google' ? (
          <>
            {renderBaseUrlAndTimeout(
              settings.providers.google.baseUrl,
              settings.providers.google.timeoutMs,
              (value) =>
                updateSettings('google', {
                  ...settings.providers.google,
                  baseUrl: value
                }),
              (value) =>
                updateSettings('google', {
                  ...settings.providers.google,
                  timeoutMs: value
                })
            )}
          </>
        ) : null}

        {activeProviderId === 'tencent' ? (
          <>
            <SecretField
              label="SecretId"
              value={settings.providers.tencent.secretId}
              onChange={(value) =>
                updateSettings('tencent', {
                  ...settings.providers.tencent,
                  secretId: value
                })
              }
            />
            <SecretField
              label="SecretKey"
              value={settings.providers.tencent.secretKey}
              onChange={(value) =>
                updateSettings('tencent', {
                  ...settings.providers.tencent,
                  secretKey: value
                })
              }
            />
            {renderTextField('Region', settings.providers.tencent.region, (value) =>
              updateSettings('tencent', {
                ...settings.providers.tencent,
                region: value
              })
            )}
            {renderBaseUrlAndTimeout(
              settings.providers.tencent.baseUrl,
              settings.providers.tencent.timeoutMs,
              (value) =>
                updateSettings('tencent', {
                  ...settings.providers.tencent,
                  baseUrl: value
                }),
              (value) =>
                updateSettings('tencent', {
                  ...settings.providers.tencent,
                  timeoutMs: value
                })
            )}
          </>
        ) : null}

        {activeProviderId === 'tongyi' ? (
          <>
            <SecretField
              label="API Key"
              value={settings.providers.tongyi.apiKey}
              placeholder="dashscope-..."
              onChange={(value) =>
                updateSettings('tongyi', {
                  ...settings.providers.tongyi,
                  apiKey: value
                })
              }
            />
            {renderTextField('Model', settings.providers.tongyi.model, (value) =>
              updateSettings('tongyi', {
                ...settings.providers.tongyi,
                model: value
              })
            )}
            {renderBaseUrlAndTimeout(
              settings.providers.tongyi.baseUrl,
              settings.providers.tongyi.timeoutMs,
              (value) =>
                updateSettings('tongyi', {
                  ...settings.providers.tongyi,
                  baseUrl: value
                }),
              (value) =>
                updateSettings('tongyi', {
                  ...settings.providers.tongyi,
                  timeoutMs: value
                })
            )}
            {renderPromptFields(
              settings.providers.tongyi.systemPrompt,
              settings.providers.tongyi.userPromptTemplate,
              (value) =>
                updateSettings('tongyi', {
                  ...settings.providers.tongyi,
                  systemPrompt: value
                }),
              (value) =>
                updateSettings('tongyi', {
                  ...settings.providers.tongyi,
                  userPromptTemplate: value
                })
            )}
          </>
        ) : null}

        {activeProviderId === 'custom' ? (
          <>
            <SecretField
              label="API Key"
              value={settings.providers.custom.apiKey}
              placeholder="sk-..."
              onChange={(value) =>
                updateSettings('custom', {
                  ...settings.providers.custom,
                  apiKey: value
                })
              }
            />
            {renderTextField('Model', settings.providers.custom.model, (value) =>
              updateSettings('custom', {
                ...settings.providers.custom,
                model: value
              })
            )}
            <label className="field">
              <span className="field-label">Request Format</span>
              <select
                aria-label="Request Format"
                value={settings.providers.custom.requestFormat}
                onChange={(event) =>
                  updateSettings('custom', {
                    ...settings.providers.custom,
                    requestFormat: event.target.value as ProviderSettingsMap['custom']['requestFormat']
                  })
                }
              >
                <option value="openai-chat">OpenAI Chat</option>
              </select>
            </label>
            {renderBaseUrlAndTimeout(
              settings.providers.custom.baseUrl,
              settings.providers.custom.timeoutMs,
              (value) =>
                updateSettings('custom', {
                  ...settings.providers.custom,
                  baseUrl: value
                }),
              (value) =>
                updateSettings('custom', {
                  ...settings.providers.custom,
                  timeoutMs: value
                })
            )}
            {renderPromptFields(
              settings.providers.custom.systemPrompt,
              settings.providers.custom.userPromptTemplate,
              (value) =>
                updateSettings('custom', {
                  ...settings.providers.custom,
                  systemPrompt: value
                }),
              (value) =>
                updateSettings('custom', {
                  ...settings.providers.custom,
                  userPromptTemplate: value
                })
            )}
          </>
        ) : null}

        {activeProviderId === 'mock' ? (
          <>
            {renderTextField('Prefix', settings.providers.mock.prefix, (value) =>
              updateSettings('mock', {
                ...settings.providers.mock,
                prefix: value
              })
            )}
            {renderNumberField('Latency (ms)', settings.providers.mock.latencyMs, (value) =>
              updateSettings('mock', {
                ...settings.providers.mock,
                latencyMs: value
              })
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
