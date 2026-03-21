import type { BrowserWindow } from 'electron';

import type {
  PromptAnchor,
  PromptSession,
  PromptSessionResult
} from '../../shared/types/context-prompt';
import type {
  ContextPromptSessionService
} from './context-prompt-session-service';
import type { ContextPromptWindowService } from './context-prompt-window-service';

export interface ContextPromptRequestService {
  requestContextInstructions(
    sourceText: string,
    anchor?: PromptAnchor
  ): Promise<string | null>;
}

export interface CreateContextPromptRequestServiceOptions {
  promptSessionService: ContextPromptSessionService;
  promptWindowService: ContextPromptWindowService;
}

type PromptWindowHandle = Pick<BrowserWindow, 'once' | 'removeListener'>;

export function createContextPromptRequestService({
  promptSessionService,
  promptWindowService
}: CreateContextPromptRequestServiceOptions): ContextPromptRequestService {
  let activeRequest: Promise<string | null> | null = null;

  return {
    async requestContextInstructions(
      sourceText: string,
      anchor?: PromptAnchor
    ): Promise<string | null> {
      const activeSession = promptSessionService.getActive();

      if (activeSession && activeRequest) {
        try {
          await promptWindowService.open(activeSession);
        } catch (error) {
          promptSessionService.clear();
          throw error;
        }
        return activeRequest;
      }

      const session: PromptSession = {
        sourceText,
        anchor: anchor ?? { kind: 'unknown' }
      };

      const sessionResultPromise = promptSessionService.open(session);
      const mappedResultPromise = sessionResultPromise.then(mapPromptSessionResult);
      activeRequest = mappedResultPromise.finally(() => {
        activeRequest = null;
      });

      let promptWindow: PromptWindowHandle | null = null;
      const handleClosed = (): void => {
        if (promptSessionService.getActive()) {
          promptSessionService.clear();
        }
      };

      try {
        promptWindow = (await promptWindowService.open(session)) as PromptWindowHandle;
        promptWindow.once('closed', handleClosed);
        return await mappedResultPromise;
      } catch (error) {
        promptSessionService.clear();
        throw error;
      } finally {
        promptWindow?.removeListener('closed', handleClosed);
      }
    }
  };
}

function mapPromptSessionResult(result: PromptSessionResult): string | null {
  switch (result.status) {
    case 'submitted':
      return result.instructions;
    case 'cancelled':
    case 'cleared':
      return null;
  }
}
