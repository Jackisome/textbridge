import { providerMetadata, providerMetadataList } from '../../shared/constants/provider-metadata';
import { ShortcutCaptureInput } from '../components/shortcut-capture-input';
import { ProviderConfigPanel } from '../components/provider-config-panel';
import { ProviderTile } from '../components/provider-tile';
import { RuntimeStatusPanel } from '../features/runtime-status/runtime-status-panel';
import type { RuntimeStatus } from '../../shared/types/ipc';
import type { ElectronInfo } from '../../shared/types/preload';
import type { ProviderId, ProviderSettingsMap, TranslationClientSettings } from '../types/settings';

const navigationItems = [
  { href: '#general', label: '常规' },
  { href: '#translation', label: '翻译' },
  { href: '#provider', label: 'Provider' },
  { href: '#shortcuts', label: '快捷键' },
  { href: '#runtime', label: '运行状态' }
] as const;

const languageOptions = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' }
] as const;

interface SettingsPageProps {
  electronInfo: ElectronInfo;
  settings: TranslationClientSettings;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  saveMessage: string | null;
  runtimeStatus: RuntimeStatus | null;
  onSettingChange: <Key extends keyof TranslationClientSettings>(
    key: Key,
    value: TranslationClientSettings[Key]
  ) => void;
  onActiveProviderChange: (providerId: ProviderId) => void;
  onProviderSettingsChange: (providerId: ProviderId, nextSettings: ProviderSettingsMap[ProviderId]) => void;
  onSave: () => void;
  onReset: () => void;
}

function renderBooleanToggle(
  label: string,
  description: string,
  checked: boolean,
  onChange: (checked: boolean) => void
) {
  return (
    <label className="toggle-row">
      <span className="toggle-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="switch__track" aria-hidden="true" />
      </span>
    </label>
  );
}

export function SettingsPage({
  electronInfo,
  settings,
  isDirty,
  isLoading,
  isSaving,
  saveMessage,
  runtimeStatus,
  onSettingChange,
  onActiveProviderChange,
  onProviderSettingsChange,
  onSave,
  onReset
}: SettingsPageProps) {
  const activeProviderMetadata = providerMetadata[settings.activeProviderId];

  return (
    <main className="settings-layout">
      <aside className="settings-sidebar">
        <div className="brand-block">
          <span className="brand-pill">Windows Text Translation MVP</span>
          <h1>TextBridge 设置中心</h1>
          <p>
            面向桌面翻译场景的常规设置、Provider 配置、快捷键与运行状态都收敛在同一页里。
          </p>
        </div>

        <nav className="side-nav" aria-label="设置分区">
          {navigationItems.map((item) => (
            <a className="side-nav__item" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <section className="sidebar-status">
          <span className="sidebar-status__label">本地存储</span>
          <strong>
            {isLoading ? '正在读取配置' : isDirty ? '有未保存更改' : '设置已同步'}
          </strong>
          <p>当前版本会把设置写入 Electron 的用户数据目录，而不是只保存在浏览器存储里。</p>
        </section>
      </aside>

      <div className="settings-main">
        <header className="settings-header">
          <h2>翻译流程与系统行为</h2>

          <div className="header-actions">
            <button type="button" className="secondary-button" onClick={onReset}>
              放弃更改
            </button>
            <button type="button" className="primary-button" onClick={onSave}>
              {isSaving ? '保存中...' : '保存更改'}
            </button>
          </div>
        </header>

        {saveMessage !== null ? <p className="save-feedback">{saveMessage}</p> : null}

        <div className="settings-grid">
          <section className="settings-card" id="general">
            <div>
              <p className="card-kicker">系统行为</p>
              <h3>常规设置</h3>
            </div>

            <div className="toggle-list">
              {renderBooleanToggle(
                '关闭到托盘',
                '关闭主窗口时保留后台运行，方便继续响应全局快捷键。',
                settings.closeToTray,
                (value) => onSettingChange('closeToTray', value)
              )}
              {renderBooleanToggle(
                '启动最小化',
                '应用启动后直接收纳到后台，减少开机打断感。',
                settings.startMinimized,
                (value) => onSettingChange('startMinimized', value)
              )}
              {renderBooleanToggle(
                '启用剪贴板回退',
                '系统捕获失败时允许退回到剪贴板路径。',
                settings.enableClipboardFallback,
                (value) => onSettingChange('enableClipboardFallback', value)
              )}
              {renderBooleanToggle(
                '启用弹窗兜底',
                '写回失败时保留弹窗结果，避免翻译内容直接丢失。',
                settings.enablePopupFallback,
                (value) => onSettingChange('enablePopupFallback', value)
              )}
            </div>
          </section>

          <section className="settings-card" id="translation">
            <div>
              <p className="card-kicker">翻译链路</p>
              <h3>翻译偏好</h3>
            </div>

            <div className="field-grid">
              <label className="field">
                <span className="field-label">源语言</span>
                <select
                  value={settings.sourceLanguage}
                  onChange={(event) => onSettingChange('sourceLanguage', event.target.value)}
                >
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">目标语言</span>
                <select
                  value={settings.targetLanguage}
                  onChange={(event) => onSettingChange('targetLanguage', event.target.value)}
                >
                  {languageOptions
                    .filter((option) => option.value !== 'auto')
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">输出模式</span>
                <select
                  value={settings.outputMode}
                  onChange={(event) =>
                    onSettingChange('outputMode', event.target.value as TranslationClientSettings['outputMode'])
                  }
                >
                  <option value="replace-original">替换原文</option>
                  <option value="show-popup">弹窗展示</option>
                </select>
              </label>

              <label className="field field--wide">
                <span className="field-label">捕获策略</span>
                <select
                  value={settings.captureMode}
                  onChange={(event) =>
                    onSettingChange('captureMode', event.target.value as TranslationClientSettings['captureMode'])
                  }
                >
                  <option value="uia-first">优先 UIA — 系统 API 直接读取，不污染剪贴板</option>
                  <option value="clipboard-first">优先剪贴板 — 模拟复制，兼容性好但覆盖剪贴板</option>
                </select>
              </label>
            </div>
          </section>

          <section className="settings-card settings-card--provider settings-card--span-2" id="provider">
            <div className="provider-workspace__header">
              <div>
                <p className="card-kicker">翻译引擎控制面板</p>
                <h3>Provider 工作台</h3>
              </div>
              <div className="provider-workspace__summary">
                <span className="provider-workspace__summary-label">当前引擎</span>
                <strong>{activeProviderMetadata.label}</strong>
                <span>{activeProviderMetadata.description}</span>
              </div>
            </div>

            <div className="provider-workspace">
              <section className="provider-selector-panel">
                <div className="provider-selector-panel__intro">
                  <p>
                    先选择当前要启用的翻译引擎，再在右侧填写这一家 provider 所需的凭证、入口和提示词。
                  </p>
                </div>

                <div className="provider-tile-grid" role="list" aria-label="可用 Provider">
                  {providerMetadataList.map((metadata) => (
                    <ProviderTile
                      key={metadata.id}
                      metadata={metadata}
                      isActive={settings.activeProviderId === metadata.id}
                      onSelect={() => onActiveProviderChange(metadata.id)}
                    />
                  ))}
                </div>
              </section>

              <ProviderConfigPanel
                settings={settings}
                onProviderSettingsChange={onProviderSettingsChange}
              />
            </div>
          </section>

          <section className="settings-card" id="shortcuts">
            <div>
              <p className="card-kicker">全局触发</p>
              <h3>快捷键设置</h3>
            </div>

            <div className="field-grid field-grid--single">
              <ShortcutCaptureInput
                label="快速翻译快捷键"
                value={settings.quickTranslateShortcut}
                onChange={(value) => onSettingChange('quickTranslateShortcut', value)}
              />
              <ShortcutCaptureInput
                label="上下文翻译快捷键"
                value={settings.contextTranslateShortcut}
                onChange={(value) => onSettingChange('contextTranslateShortcut', value)}
                hint="建议至少包含一个修饰键，或直接使用功能键。"
              />
            </div>
          </section>

          <RuntimeStatusPanel
            electronInfo={electronInfo}
            runtimeStatus={runtimeStatus}
          />
        </div>
      </div>
    </main>
  );
}
