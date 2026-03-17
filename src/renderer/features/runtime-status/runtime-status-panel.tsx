import type { RuntimeStatus } from '../../../shared/types/ipc';
import type { ElectronInfo } from '../../../shared/types/preload';

export interface RuntimeStatusPanelProps {
  electronInfo: ElectronInfo;
  runtimeStatus: RuntimeStatus | null;
}

export function RuntimeStatusPanel({
  electronInfo,
  runtimeStatus
}: RuntimeStatusPanelProps) {
  return (
    <section className="settings-card settings-card--accent runtime-panel" id="runtime">
      <div className="runtime-panel__header">
        <div>
          <p className="card-kicker">桌面环境</p>
          <h2>运行状态</h2>
          <p className="runtime-panel__copy">
            查看当前 provider、快捷键注册状态、helper 诊断和最近执行摘要。
          </p>
        </div>
        <span
          className={`runtime-badge ${
            runtimeStatus?.ready ? 'runtime-badge--ready' : 'runtime-badge--offline'
          }`}
        >
          {runtimeStatus?.ready ? '已就绪' : '加载中'}
        </span>
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
        <article>
          <span>当前 Provider</span>
          <strong>{runtimeStatus?.activeProvider ?? 'unknown'}</strong>
        </article>
        <article>
          <span>已注册快捷键</span>
          <strong>{runtimeStatus?.registeredShortcuts.join(' / ') || '未注册'}</strong>
        </article>
        <article>
          <span>Helper 状态</span>
          <strong>{runtimeStatus?.helperState ?? 'idle'}</strong>
        </article>
        <article>
          <span>最近 Helper 错误</span>
          <strong>{runtimeStatus?.helperLastErrorCode ?? '无'}</strong>
        </article>
        <article>
          <span>Helper PID</span>
          <strong>{runtimeStatus?.helperPid ?? '未启动'}</strong>
        </article>
      </div>

      <p className="runtime-note">
        设置会通过 preload 暴露的稳定接口写入主进程配置文件，并立即触发快捷键重载与运行状态刷新。
      </p>

      <div className="runtime-log">
        <h3>最近执行</h3>
        {!runtimeStatus || runtimeStatus.recentExecutions.length === 0 ? (
          <p>当前还没有记录到执行报告。</p>
        ) : (
          <div className="runtime-log-list">
            {runtimeStatus.recentExecutions.map((entry) => (
              <article className="runtime-log-item" key={entry.id}>
                <header>
                  <strong>{entry.workflow}</strong>
                  <span>{entry.status}</span>
                </header>
                <p>
                  Provider: {entry.provider ?? 'n/a'} · 捕获: {entry.captureMethod ?? 'n/a'} ·
                  回写: {entry.writeBackMethod ?? 'n/a'}
                </p>
                <p>
                  原文长度: {entry.sourceTextLength} · 译文长度: {entry.translatedTextLength}
                </p>
                {entry.errorMessage ? <p className="error-note">{entry.errorMessage}</p> : null}
                {entry.sourceTextPreview ? (
                  <p className="preview-note">原文摘要: {entry.sourceTextPreview}</p>
                ) : null}
                {entry.translatedTextPreview ? (
                  <p className="preview-note">译文摘要: {entry.translatedTextPreview}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
