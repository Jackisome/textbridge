import type { RuntimeStatus } from '../../../shared/types/ipc';

export interface RuntimeStatusPanelProps {
  runtimeStatus: RuntimeStatus | null;
}

export function RuntimeStatusPanel({ runtimeStatus }: RuntimeStatusPanelProps) {
  if (!runtimeStatus) {
    return (
      <section className="settings-panel runtime-panel">
        <div className="settings-panel-header">
          <h2>运行状态</h2>
          <span className="runtime-badge offline">加载中</span>
        </div>
        <p className="panel-description">正在读取主进程运行状态与最近执行记录。</p>
      </section>
    );
  }

  return (
    <section className="settings-panel runtime-panel" id="runtime-section">
      <div className="runtime-header">
        <div>
          <h2>运行状态</h2>
          <p className="panel-description">查看当前 provider、快捷键注册状态，以及最近执行记录。</p>
        </div>
        <span className={`runtime-badge ${runtimeStatus.ready ? 'ready' : 'offline'}`}>
          {runtimeStatus.ready ? '已就绪' : '启动中'}
        </span>
      </div>

      <div className="runtime-grid">
        <article className="runtime-card">
          <strong>当前 Provider</strong>
          <span>{runtimeStatus.activeProvider}</span>
        </article>
        <article className="runtime-card">
          <strong>平台</strong>
          <span>{runtimeStatus.platform}</span>
        </article>
        <article className="runtime-card">
          <strong>已注册快捷键</strong>
          <span>{runtimeStatus.registeredShortcuts.join(' / ') || '未注册'}</span>
        </article>
        <article className="runtime-card">
          <strong>最近状态</strong>
          <span>{runtimeStatus.lastExecution?.status ?? '暂无执行记录'}</span>
        </article>
        <article className="runtime-card">
          <strong>Helper 状态</strong>
          <span>{runtimeStatus.helperState}</span>
        </article>
        <article className="runtime-card">
          <strong>最近 Helper 错误</strong>
          <span>{runtimeStatus.helperLastErrorCode ?? '无'}</span>
        </article>
        <article className="runtime-card">
          <strong>Helper PID</strong>
          <span>{runtimeStatus.helperPid ?? '未启动'}</span>
        </article>
      </div>

      <div className="runtime-log">
        <h3>最近执行</h3>
        {runtimeStatus.recentExecutions.length === 0 ? (
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
