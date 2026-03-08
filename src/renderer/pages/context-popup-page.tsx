import { createContextPopupState } from '../features/popup-state';

export interface ContextPopupPageProps {
  sourceText?: string;
}

export function ContextPopupPage({
  sourceText = 'Paste or capture text before submitting extra translation instructions.'
}: ContextPopupPageProps) {
  const state = createContextPopupState(sourceText);

  return (
    <main className="popup-shell">
      <section className="popup-card">
        <span className="popup-kicker">Context Prompt</span>
        <h1>{state.title}</h1>
        <p className="popup-copy">
          在这里补充语气、受众、术语和格式要求，再由主流程把这些指令带入统一翻译请求。
        </p>

        <div className="popup-source">
          <strong>Captured Text</strong>
          <p>{state.sourceText}</p>
        </div>

        <label className="popup-label" htmlFor="context-instructions">
          Instructions
        </label>
        <textarea
          id="context-instructions"
          className="popup-textarea"
          placeholder={state.instructionsPlaceholder}
          defaultValue=""
        />

        <div className="popup-actions">
          {state.actions.map((action) => (
            <button
              className={`popup-button ${action.id === 'submit-context' ? 'primary' : 'ghost'}`}
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
