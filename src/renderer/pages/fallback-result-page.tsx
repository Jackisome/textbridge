import { createFallbackResultPopupState } from '../features/popup-state';

export interface FallbackResultPageProps {
  translatedText?: string;
  errorMessage?: string;
}

export function FallbackResultPage({
  translatedText = 'Your translated result will appear here when write-back requires manual confirmation.',
  errorMessage = 'Write-back failed, popup fallback is required.'
}: FallbackResultPageProps) {
  const state = createFallbackResultPopupState({
    translatedText,
    errorMessage
  });

  return (
    <main className="popup-shell fallback-shell">
      <section className="popup-card">
        <span className="popup-kicker">Fallback Result</span>
        <h1>{state.title}</h1>
        <p className="popup-copy">
          自动回写没有完成时，这里保留可复制结果，并提供一次重新插回的触发入口。
        </p>

        <div className="popup-source">
          <strong>Latest Result</strong>
          <p>{state.translatedText}</p>
        </div>

        {state.errorMessage ? <p className="error-note">{state.errorMessage}</p> : null}

        <div className="popup-actions">
          {state.actions.map((action) => (
            <button
              className={`popup-button ${action.id === 'copy-result' ? 'primary' : 'ghost'}`}
              key={action.id}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
