import type { PromptSession, PromptSubmission } from '../../shared/types/context-prompt';

function getContextPromptBridge() {
  if (typeof window === 'undefined' || window.textBridge === undefined) {
    return null;
  }

  return window.textBridge;
}

export async function getContextPromptSession(): Promise<PromptSession | null> {
  const bridge = getContextPromptBridge();

  if (bridge === null) {
    return null;
  }

  return bridge.getContextPromptSession();
}

export async function submitContextPrompt(instructions: string): Promise<void> {
  const bridge = getContextPromptBridge();

  if (bridge === null) {
    return;
  }

  const submission: PromptSubmission = {
    instructions
  };

  await bridge.submitContextPrompt(submission);
}

export async function cancelContextPrompt(): Promise<void> {
  const bridge = getContextPromptBridge();

  if (bridge === null) {
    return;
  }

  await bridge.cancelContextPrompt();
}
