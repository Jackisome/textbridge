import type {
  PromptAnchor,
  PromptCancelledResult,
  PromptSession,
  PromptSessionResult,
  PromptSubmission,
  PromptSubmittedResult
} from '../../shared/types/context-prompt';

export interface ContextPromptSessionService {
  open(session: PromptSession): Promise<PromptSessionResult>;
  getActive(): PromptSession | null;
  submit(submission: PromptSubmission): void;
  cancel(): void;
  clear(): void;
}

export function createContextPromptSessionService(): ContextPromptSessionService {
  let activeSession: PromptSession | null = null;
  let activeResolve: ((result: PromptSessionResult) => void) | null = null;
  let activePromise: Promise<PromptSessionResult> | null = null;

  function open(session: PromptSession): Promise<PromptSessionResult> {
    if (activePromise) {
      return activePromise;
    }

    activeSession = clonePromptSession(session);
    activePromise = new Promise<PromptSessionResult>((resolve) => {
      activeResolve = resolve;
    });

    return activePromise;
  }

  function getActive(): PromptSession | null {
    return activeSession ? clonePromptSession(activeSession) : null;
  }

  function submit(submission: PromptSubmission): void {
    resolveActiveSession({
      status: 'submitted',
      instructions: submission.instructions
    });
  }

  function cancel(): void {
    resolveActiveSession({
      status: 'cancelled'
    });
  }

  function clear(): void {
    activeSession = null;
    activeResolve = null;
    activePromise = null;
  }

  function resolveActiveSession(result: PromptSessionResult): void {
    if (!activeResolve) {
      return;
    }

    const resolve = activeResolve;
    clear();
    resolve(result);
  }

  return {
    open,
    getActive,
    submit,
    cancel,
    clear
  };
}

function clonePromptSession(session: PromptSession): PromptSession {
  return {
    sourceText: session.sourceText,
    anchor: clonePromptAnchor(session.anchor)
  };
}

function clonePromptAnchor(anchor: PromptAnchor): PromptAnchor {
  return {
    kind: anchor.kind,
    displayId: anchor.displayId,
    bounds: anchor.bounds
      ? {
          x: anchor.bounds.x,
          y: anchor.bounds.y,
          width: anchor.bounds.width,
          height: anchor.bounds.height
        }
      : undefined
  };
}
