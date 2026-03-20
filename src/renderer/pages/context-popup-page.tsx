import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export interface ContextPopupPageProps {
  sourceText: string;
  onSubmit: (instructions: string) => Promise<void> | void;
  onCancel: () => Promise<void> | void;
}

const instructionsPlaceholder = 'Add tone, audience, or formatting requirements.';

export function ContextPopupPage({ sourceText, onSubmit, onCancel }: ContextPopupPageProps) {
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function submit() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(instructions);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function cancel() {
    if (isSubmitting) {
      return;
    }

    await onCancel();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      void cancel();
    }
  }

  return (
    <main className="popup-shell">
      <section className="popup-card">
        <span className="popup-kicker">Context Prompt</span>
        <header className="popup-header">
          <div>
            <h1>Context Translation</h1>
            <p className="popup-copy">
              在这里补充语气、受众、术语和格式要求，再由主流程把这些指令带入统一翻译请求。
            </p>
          </div>
        </header>

        <div className="popup-source">
          <strong>Captured Text</strong>
          <p>{sourceText}</p>
        </div>

        <label className="popup-label" htmlFor="context-instructions">
          Instructions
        </label>
        <textarea
          ref={textareaRef}
          id="context-instructions"
          className="popup-textarea"
          placeholder={instructionsPlaceholder}
          value={instructions}
          onChange={(event) => {
            setInstructions(event.target.value);
          }}
          onKeyDown={handleKeyDown}
        />

        <div className="popup-actions">
          <button
            className="popup-button ghost"
            type="button"
            onClick={() => {
              void cancel();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="popup-button primary"
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={isSubmitting}
          >
            Translate
          </button>
        </div>
      </section>
    </main>
  );
}
