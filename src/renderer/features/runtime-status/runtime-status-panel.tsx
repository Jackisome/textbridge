import type { RuntimeStatus } from '../../../shared/types/ipc';

export interface RuntimeStatusPanelProps {
  runtimeStatus: RuntimeStatus | null;
}

export function RuntimeStatusPanel({ runtimeStatus }: RuntimeStatusPanelProps) {
  if (!runtimeStatus) {
    return (
      <section className="panel runtime-panel">
        <h2>Runtime Status</h2>
        <p>Loading runtime diagnostics...</p>
      </section>
    );
  }

  return (
    <section className="panel runtime-panel">
      <div className="runtime-header">
        <div>
          <h2>Runtime Status</h2>
          <p>查看当前 provider、快捷键注册状态，以及最近执行记录。</p>
        </div>
        <span className={`runtime-badge ${runtimeStatus.ready ? 'ready' : 'offline'}`}>
          {runtimeStatus.ready ? 'Ready' : 'Starting'}
        </span>
      </div>

      <div className="runtime-grid">
        <article className="runtime-card">
          <strong>Active Provider</strong>
          <span>{runtimeStatus.activeProvider}</span>
        </article>
        <article className="runtime-card">
          <strong>Platform</strong>
          <span>{runtimeStatus.platform}</span>
        </article>
        <article className="runtime-card">
          <strong>Registered Shortcuts</strong>
          <span>{runtimeStatus.registeredShortcuts.join(' / ') || 'None'}</span>
        </article>
        <article className="runtime-card">
          <strong>Last Status</strong>
          <span>{runtimeStatus.lastExecution?.status ?? 'No runs yet'}</span>
        </article>
      </div>

      <div className="runtime-log">
        <h3>Recent Executions</h3>
        {runtimeStatus.recentExecutions.length === 0 ? (
          <p>No execution reports recorded yet.</p>
        ) : (
          <div className="runtime-log-list">
            {runtimeStatus.recentExecutions.map((entry) => (
              <article className="runtime-log-item" key={entry.id}>
                <header>
                  <strong>{entry.workflow}</strong>
                  <span>{entry.status}</span>
                </header>
                <p>
                  Provider: {entry.provider ?? 'n/a'} · Capture: {entry.captureMethod ?? 'n/a'} ·
                  Write-back: {entry.writeBackMethod ?? 'n/a'}
                </p>
                <p>
                  Source length: {entry.sourceTextLength} · Translation length:{' '}
                  {entry.translatedTextLength}
                </p>
                {entry.errorMessage ? <p className="error-note">{entry.errorMessage}</p> : null}
                {entry.sourceTextPreview ? (
                  <p className="preview-note">Source preview: {entry.sourceTextPreview}</p>
                ) : null}
                {entry.translatedTextPreview ? (
                  <p className="preview-note">
                    Translation preview: {entry.translatedTextPreview}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
