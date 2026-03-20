import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { PromptSubmission } from '../../shared/types/context-prompt';
import type { ContextPromptSessionService } from '../services/context-prompt-session-service';

export interface RegisterContextPromptIpcOptions {
  promptSessionService: ContextPromptSessionService;
  promptWindowService?: {
    close(): void;
  };
}

export function registerContextPromptIpc({
  promptSessionService,
  promptWindowService
}: RegisterContextPromptIpcOptions): void {
  if (typeof ipcMain.removeHandler === 'function') {
    ipcMain.removeHandler(IPC_CHANNELS.contextPrompt.getSession);
    ipcMain.removeHandler(IPC_CHANNELS.contextPrompt.submit);
    ipcMain.removeHandler(IPC_CHANNELS.contextPrompt.cancel);
  }

  ipcMain.handle(IPC_CHANNELS.contextPrompt.getSession, async () => {
    return promptSessionService.getActive();
  });

  ipcMain.handle(
    IPC_CHANNELS.contextPrompt.submit,
    async (_event, submission: PromptSubmission) => {
      promptSessionService.submit(submission);
      promptWindowService?.close();
    }
  );

  ipcMain.handle(IPC_CHANNELS.contextPrompt.cancel, async () => {
    promptSessionService.cancel();
    promptWindowService?.close();
  });
}
