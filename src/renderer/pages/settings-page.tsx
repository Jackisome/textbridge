import { RuntimeStatusPanel } from '../features/runtime-status/runtime-status-panel';
import type { ElectronInfo, RuntimeStatus } from '../../shared/types/ipc';
import type {
  AppSettings,
  CaptureMethodPreference,
  OutputMode,
  TranslationProviderKind
} from '../../shared/types/settings';

const navigationItems = [
  { id: 'general-section', label: '常规', subtitle: '托盘与启动' },
  { id: 'translation-section', label: '翻译设置', subtitle: '语言与 Provider' },
  { id: 'shortcuts-section', label: '快捷键', subtitle: '全局触发' },
  { id: 'fallback-section', label: '捕获与回写', subtitle: 'Fallback 策略' },
  { id: 'runtime-section', label: '运行状态', subtitle: '执行摘要' }
];

export interface SettingsPageProps {
  electronInfo: ElectronInfo;
  runtimeStatus: RuntimeStatus | null;
  draftSettings: AppSettings;
  isSaving: boolean;
  saveMessage: string | null;
  onSave(): void;
  onReset(): void;
  onStringFieldChange(path: string, value: string): void;
  onBooleanFieldChange(path: string, value: boolean): void;
  onNumberFieldChange(path: string, value: number): void;
  onProviderKindChange(kind: TranslationProviderKind): void;
  onOutputModeChange(mode: OutputMode): void;
  onCaptureMethodChange(method: CaptureMethodPreference): void;
}

export function SettingsPage({
  electronInfo,
  runtimeStatus,
  draftSettings,
  isSaving,
  saveMessage,
  onSave,
  onReset,
  onStringFieldChange,
  onBooleanFieldChange,
  onNumberFieldChange,
  onProviderKindChange,
  onOutputModeChange,
  onCaptureMethodChange
}: SettingsPageProps) {
  return (
    <main className="settings-dashboard">
      <aside className="settings-sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-mark">TB</span>
          <div>
            <strong>TextBridge</strong>
            <p>Windows Translation Client</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Settings navigation">
          {navigationItems.map((item) => (
            <a className="sidebar-link" href={`#${item.id}`} key={item.id}>
              <strong>{item.label}</strong>
              <span>{item.subtitle}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-meta">
          <div className="meta-chip">
            <span>Electron</span>
            <strong>{electronInfo.electron}</strong>
          </div>
          <div className="meta-chip">
            <span>Platform</span>
            <strong>{electronInfo.platform}</strong>
          </div>
        </div>
      </aside>

      <section className="settings-main">
        <header className="settings-topbar">
          <div>
            <p className="eyebrow">Settings Center</p>
            <h1>设置</h1>
            <p className="topbar-copy">
              以浅色工具型界面集中管理 TextBridge 的翻译策略、快捷键、托盘行为和回写兜底。
            </p>
          </div>

          <div className="settings-actions">
            {saveMessage ? <p className="save-message">{saveMessage}</p> : null}
            <button className="ghost-button" onClick={onReset} type="button">
              重置修改
            </button>
            <button className="primary-button" disabled={isSaving} onClick={onSave} type="button">
              {isSaving ? '保存中...' : '保存更改'}
            </button>
          </div>
        </header>

        <div className="settings-grid">
          <section className="settings-panel" id="general-section">
            <div className="settings-panel-header">
              <div>
                <h2>托盘与启动</h2>
                <p className="panel-description">定义窗口关闭行为、托盘驻留和初始启动形态。</p>
              </div>
            </div>

            <div className="settings-field-list">
              <ToggleRow
                checked={draftSettings.ui.closeMainWindowToTray}
                description="关闭主窗口时保留后台运行，并从托盘恢复。"
                label="关闭时最小化到托盘"
                onChange={(value) => onBooleanFieldChange('ui.closeMainWindowToTray', value)}
              />
              <ToggleRow
                checked={draftSettings.ui.startMinimized}
                description="启动应用时不直接打断当前工作流。"
                label="启动时最小化"
                onChange={(value) => onBooleanFieldChange('ui.startMinimized', value)}
              />
            </div>
          </section>

          <section className="settings-panel" id="translation-section">
            <div className="settings-panel-header">
              <div>
                <h2>翻译设置</h2>
                <p className="panel-description">管理源/目标语言、Provider 与 HTTP 连接参数。</p>
              </div>
            </div>

            <div className="form-grid two-columns">
              <label className="settings-field">
                <span>源语言</span>
                <select
                  onChange={(event) => onStringFieldChange('sourceLanguage', event.target.value)}
                  value={draftSettings.sourceLanguage}
                >
                  <option value="auto">自动检测</option>
                  <option value="zh-CN">中文</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                </select>
              </label>

              <label className="settings-field">
                <span>目标语言</span>
                <select
                  onChange={(event) => onStringFieldChange('targetLanguage', event.target.value)}
                  value={draftSettings.targetLanguage}
                >
                  <option value="zh-CN">中文</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                  <option value="ko">한국어</option>
                </select>
              </label>

              <label className="settings-field">
                <span>Provider</span>
                <select
                  onChange={(event) =>
                    onProviderKindChange(event.target.value as TranslationProviderKind)
                  }
                  value={draftSettings.provider.kind}
                >
                  <option value="mock">Mock Provider</option>
                  <option value="http">HTTP Provider</option>
                </select>
              </label>

              <label className="settings-field">
                <span>超时时间（ms）</span>
                <input
                  min={1000}
                  onChange={(event) =>
                    onNumberFieldChange('provider.timeoutMs', Number(event.target.value))
                  }
                  type="number"
                  value={draftSettings.provider.timeoutMs}
                />
              </label>

              <label className="settings-field full-width">
                <span>Endpoint</span>
                <input
                  disabled={draftSettings.provider.kind !== 'http'}
                  onChange={(event) => onStringFieldChange('provider.endpoint', event.target.value)}
                  placeholder="https://api.example.com/translate"
                  type="text"
                  value={draftSettings.provider.endpoint}
                />
              </label>

              <label className="settings-field">
                <span>API Key</span>
                <input
                  disabled={draftSettings.provider.kind !== 'http'}
                  onChange={(event) => onStringFieldChange('provider.apiKey', event.target.value)}
                  placeholder="sk-..."
                  type="password"
                  value={draftSettings.provider.apiKey}
                />
              </label>

              <label className="settings-field">
                <span>Model</span>
                <input
                  disabled={draftSettings.provider.kind !== 'http'}
                  onChange={(event) => onStringFieldChange('provider.model', event.target.value)}
                  placeholder="gpt-4.1-mini / custom-model"
                  type="text"
                  value={draftSettings.provider.model}
                />
              </label>
            </div>
          </section>

          <section className="settings-panel" id="shortcuts-section">
            <div className="settings-panel-header">
              <div>
                <h2>快捷键</h2>
                <p className="panel-description">配置快速翻译与增强翻译两条全局触发路径。</p>
              </div>
            </div>

            <div className="form-grid">
              <label className="settings-field">
                <span>快速翻译</span>
                <input
                  onChange={(event) =>
                    onStringFieldChange('shortcuts.quickTranslate', event.target.value)
                  }
                  type="text"
                  value={draftSettings.shortcuts.quickTranslate}
                />
              </label>

              <label className="settings-field">
                <span>增强翻译</span>
                <input
                  onChange={(event) =>
                    onStringFieldChange('shortcuts.contextTranslate', event.target.value)
                  }
                  type="text"
                  value={draftSettings.shortcuts.contextTranslate}
                />
              </label>
            </div>
          </section>

          <section className="settings-panel" id="fallback-section">
            <div className="settings-panel-header">
              <div>
                <h2>捕获与回写</h2>
                <p className="panel-description">决定捕获优先级、输出模式，以及失败后的 fallback 行为。</p>
              </div>
            </div>

            <div className="form-grid two-columns">
              <label className="settings-field">
                <span>捕获优先方式</span>
                <select
                  onChange={(event) =>
                    onCaptureMethodChange(event.target.value as CaptureMethodPreference)
                  }
                  value={draftSettings.capture.preferredMethod}
                >
                  <option value="uia">UI Automation</option>
                  <option value="clipboard">Clipboard</option>
                </select>
              </label>

              <label className="settings-field">
                <span>输出模式</span>
                <select
                  onChange={(event) => onOutputModeChange(event.target.value as OutputMode)}
                  value={draftSettings.writeBack.outputMode}
                >
                  <option value="replace-original">替换原文</option>
                  <option value="append-translation">追加译文</option>
                </select>
              </label>
            </div>

            <div className="settings-field-list">
              <ToggleRow
                checked={draftSettings.capture.allowClipboardFallback}
                description="UIA 捕获失败后自动降级到剪贴板协作。"
                label="启用剪贴板捕获 fallback"
                onChange={(value) =>
                  onBooleanFieldChange('capture.allowClipboardFallback', value)
                }
              />
              <ToggleRow
                checked={draftSettings.writeBack.allowPasteFallback}
                description="直接替换失败时，尝试切换到粘贴写回。"
                label="启用粘贴写回 fallback"
                onChange={(value) => onBooleanFieldChange('writeBack.allowPasteFallback', value)}
              />
              <ToggleRow
                checked={draftSettings.writeBack.allowPopupFallback}
                description="所有自动回写失败后，保留结果并弹出手动插回窗口。"
                label="启用弹窗结果兜底"
                onChange={(value) => onBooleanFieldChange('writeBack.allowPopupFallback', value)}
              />
            </div>
          </section>

          <RuntimeStatusPanel runtimeStatus={runtimeStatus} />
        </div>
      </section>
    </main>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange(value: boolean): void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="toggle-row">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <button
        aria-pressed={checked}
        className={`switch ${checked ? 'checked' : ''}`}
        onClick={() => onChange(!checked)}
        type="button"
      >
        <span />
      </button>
    </label>
  );
}
