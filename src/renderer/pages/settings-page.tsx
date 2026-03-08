import { ShortcutCaptureInput } from '../components/shortcut-capture-input';
import type { ElectronInfo } from '../../shared/types/preload';
import type { TranslationClientSettings } from '../types/settings';

const navigationItems = [
  { href: '#general', label: '常规' },
  { href: '#translation', label: '翻译' },
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
  onSettingChange: <Key extends keyof TranslationClientSettings>(
    key: Key,
    value: TranslationClientSettings[Key]
  ) => void;
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
  onSettingChange,
  onSave,
  onReset
}: SettingsPageProps) {
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
          <div>
            <p className="eyebrow">桌面客户端设置</p>
            <h2>翻译流程与系统行为</h2>
            <p className="header-copy">点击快捷键框后直接录制组合键，保存按钮会把当前配置写入本地。</p>
          </div>

          <div className="header-actions">
            <button type="button" className="secondary-button" onClick={onReset}>
              恢复已保存
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
              <h3>Provider 与语言</h3>
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
                <span className="field-label">Provider</span>
                <select
                  value={settings.providerKind}
                  onChange={(event) =>
                    onSettingChange('providerKind', event.target.value as TranslationClientSettings['providerKind'])
                  }
                >
                  <option value="mock">Mock Provider</option>
                  <option value="http">HTTP Provider</option>
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
                <span className="field-label">HTTP Endpoint</span>
                <input
                  type="url"
                  value={settings.httpEndpoint}
                  onChange={(event) => onSettingChange('httpEndpoint', event.target.value)}
                  placeholder="https://api.example.com/v1/translate"
                />
              </label>

              <label className="field">
                <span className="field-label">模型</span>
                <input
                  type="text"
                  value={settings.model}
                  onChange={(event) => onSettingChange('model', event.target.value)}
                  placeholder="gpt-4.1-mini"
                />
              </label>

              <label className="field">
                <span className="field-label">API Key</span>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(event) => onSettingChange('apiKey', event.target.value)}
                  placeholder="sk-..."
                />
              </label>

              <label className="field">
                <span className="field-label">请求超时</span>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={settings.requestTimeoutMs}
                  onChange={(event) => onSettingChange('requestTimeoutMs', Number(event.target.value))}
                />
              </label>

              <label className="field">
                <span className="field-label">捕获策略</span>
                <select
                  value={settings.captureMode}
                  onChange={(event) =>
                    onSettingChange('captureMode', event.target.value as TranslationClientSettings['captureMode'])
                  }
                >
                  <option value="uia-first">优先 UIA</option>
                  <option value="clipboard-first">优先剪贴板</option>
                </select>
              </label>
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

          <section className="settings-card settings-card--accent" id="runtime">
            <div>
              <p className="card-kicker">桌面环境</p>
              <h3>运行状态</h3>
            </div>

            <div className="runtime-grid">
              <article>
                <span>Electron</span>
                <strong>{electronInfo.electron}</strong>
              </article>
              <article>
                <span>Node.js</span>
                <strong>{electronInfo.node}</strong>
              </article>
              <article>
                <span>Chromium</span>
                <strong>{electronInfo.chrome}</strong>
              </article>
              <article>
                <span>Platform</span>
                <strong>{electronInfo.platform}</strong>
              </article>
            </div>

            <p className="runtime-note">
              设置现在会通过 preload 暴露的稳定接口落到主进程 JSON 配置文件，快捷键录制体验也会随之持久化。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
