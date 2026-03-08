export interface PopupActionState {
  id: 'copy-result' | 'retry-write-back' | 'submit-context' | 'cancel-context';
  label: string;
}

export interface ContextPopupState {
  title: string;
  sourceText: string;
  instructionsPlaceholder: string;
  actions: PopupActionState[];
}

export interface FallbackResultPopupState {
  title: string;
  translatedText: string;
  errorMessage?: string;
  actions: PopupActionState[];
}

export function createContextPopupState(sourceText: string): ContextPopupState {
  return {
    title: 'Context Translation',
    sourceText,
    instructionsPlaceholder: 'Add tone, audience, or formatting requirements.',
    actions: [
      {
        id: 'cancel-context',
        label: 'Cancel'
      },
      {
        id: 'submit-context',
        label: 'Translate'
      }
    ]
  };
}

export function createFallbackResultPopupState({
  translatedText,
  errorMessage
}: {
  translatedText: string;
  errorMessage?: string;
}): FallbackResultPopupState {
  return {
    title: 'Result Ready for Manual Insert',
    translatedText,
    errorMessage,
    actions: [
      {
        id: 'copy-result',
        label: 'Copy Result'
      },
      {
        id: 'retry-write-back',
        label: 'Retry Insert'
      }
    ]
  };
}
