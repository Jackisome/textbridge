# Context Prompt Popup Design

**Date:** 2026-03-20
**Status:** Approved
**Feature:** Context translation prompt popup with anchor-aware placement and target restore

## 1. Overview

`context-translation` currently captures selected text and calls `popupService.requestContextInstructions(sourceText)`, but the main-process implementation is still a stub. No real popup session is created, no user input is collected, and the renderer `context-popup` view is only a static page.

This design adds a real prompt workflow for `context-translation` only:

- Triggered by the existing context-translation shortcut
- Opens a lightweight dedicated popup window
- Places the popup near the original selection when possible
- Collects optional user instructions
- Closes immediately on submit or cancel
- After translation completes, attempts to restore the original target before automatic write-back
- Falls back to popup result and clipboard when restore or write-back is not safe

The design must preserve the existing layered architecture:

- UI stays in Electron/renderer
- platform-specific selection anchoring and target restore stay under `src/electron/platform/*`
- helper processes remain focused on system interaction, not prompt UI

## 2. Goals

- Make `context-translation` actually collect user prompt input before translation
- Use a dedicated lightweight popup instead of reusing the main settings window
- Prefer showing the popup near the selected text or cursor location
- Restore the original target after prompt submission and only auto-write-back when safe
- Abstract platform-specific anchor and restore capabilities behind stable interfaces
- Keep the workflow compatible with future `darwin` and `linux` implementations

## 3. Non-Goals

- Changing `quick-translation` behavior
- Turning the prompt popup into a full workbench or settings-like screen
- Moving prompt UI into the Windows helper or any other native helper process
- Guaranteeing selection-rectangle level precision on every platform
- Forcing auto-write-back on targets that cannot be safely restored or verified

## 4. User Experience

### 4.1 Trigger

User selects text in another app and invokes the existing `context-translation` shortcut.

### 4.2 Popup Behavior

- A compact popup window opens near the selection if a precise anchor is available
- If not, placement falls back to cursor area, control/window bounds, or display center
- The textarea is focused automatically
- The popup shows:
  - short captured source preview
  - one textarea for optional instructions
  - submit action
  - cancel action

### 4.3 Interaction Rules

- `Enter` submits
- `Shift+Enter` inserts a newline
- `Esc` cancels
- clicking outside the popup cancels when the platform/window manager produces a reliable blur signal
- closing the popup window cancels
- empty instructions are allowed and treated as a valid submit

### 4.4 Post-Submit Behavior

- The popup closes immediately
- Translation runs in the background
- After translation completes, the app attempts to restore the original target
- If restore succeeds and write-back remains safe, translated text is inserted
- Otherwise the workflow degrades to existing fallback result + clipboard behavior

## 5. Architecture

### 5.1 New Main-Process Coordination Layer

Add a dedicated `context-prompt-session-service` under `src/electron/services/`.

Responsibilities:

- create and track one active prompt session at a time
- open and close the popup window
- expose session data to the popup renderer
- resolve the session on submit
- resolve the session as cancelled on `Esc`, blur-close, or manual window close
- clean up pending session state if the popup is destroyed unexpectedly

This service sits between `context-translation-runner` and the popup window implementation. The runner must only await a prompt result and must not directly manipulate `BrowserWindow` instances.

### 5.2 Cross-Platform Interaction Boundary

The current `system-interaction-service` is still effectively Win32-oriented. For this feature, selection capture needs to expand from “text only” to “text plus prompt/restore context”.

Introduce a platform-neutral capture result:

```ts
export interface SelectionContextCapture {
  sourceText: string;
  captureMethod: 'uia' | 'clipboard' | 'manual-entry';
  anchor: PromptAnchor;
  restoreTarget: RestoreTarget | null;
  capabilities: {
    canPositionPromptNearSelection: boolean;
    canRestoreTargetAfterPrompt: boolean;
    canAutoWriteBackAfterPrompt: boolean;
  };
}
```

Introduce a platform-neutral anchor model:

```ts
export interface PromptAnchor {
  kind: 'selection-rect' | 'control-rect' | 'window-rect' | 'cursor' | 'unknown';
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  displayId?: string;
}
```

Introduce a platform-neutral restore token:

```ts
export interface RestoreTarget {
  platform: 'win32' | 'darwin' | 'linux';
  token: string;
}
```

`token` is opaque to business and renderer layers. Platform adapters remain free to encode window handles, element identity, or weaker fallback metadata internally.

### 5.3 New Service Surface

Extend the system interaction boundary with capability-driven methods:

```ts
export interface SystemInteractionService {
  captureSelectionContext(settings?: TranslationClientSettings): Promise<{
    success: boolean;
    data?: SelectionContextCapture;
    errorCode?: string;
    errorMessage?: string;
  }>;
  restoreSelectionTarget(target: RestoreTarget): Promise<{
    success: boolean;
    restored: boolean;
    errorCode?: string;
    errorMessage?: string;
  }>;
  writeTranslatedText(
    text: string,
    settings?: TranslationClientSettings,
    expectedSourceText?: string
  ): Promise<WriteBackResult>;
  copyToClipboard(text: string): Promise<void>;
}
```

`context-translation-runner` should migrate to `captureSelectionContext()` while `quick-translation-runner` can continue using the simpler capture path until it needs richer metadata.

## 6. Popup Session Lifecycle

### 6.1 Single Active Session

Only one prompt session may be active at a time.

If the user triggers `context-translation` again while the popup is already open:

- do not create a second popup
- bring the existing popup to the front
- preserve its current input state

This avoids duplicate floating windows and accidental loss of prompt input.

### 6.2 Renderer Contract

Add dedicated IPC channels instead of overloading the settings API:

- `contextPrompt:getSession`
- `contextPrompt:submit`
- `contextPrompt:cancel`

The popup renderer uses these channels to:

- fetch session data on load
- submit instructions
- cancel the active session

The existing `textBridgeContracts.draftRequest` preload object must not be reused as the authoritative source for this workflow. It is currently only a static shape and does not represent a real prompt session.

### 6.3 Popup Window Lifecycle

Create a dedicated popup `BrowserWindow` with these properties:

- compact size tuned for prompt entry
- `skipTaskbar: true`
- `autoHideMenuBar: true`
- `alwaysOnTop: true` for the session lifetime only
- renderer route or query string identifying `context-popup`

When the session resolves:

- close the popup window
- clear pending session state
- release any window references

If the popup window closes before submit:

- resolve the session as cancelled
- record a structured cancellation reason for diagnostics

## 7. Placement Strategy

Placement should be driven by a shared algorithm in Electron/common code, not by per-platform ad hoc positioning logic.

Priority order:

1. `selection-rect`
2. `control-rect`
3. `cursor`
4. `window-rect`
5. current display center-top area

Shared placement rules:

- prefer placing below the anchor
- if there is insufficient space, place above
- clamp to the target display work area
- never place partially outside the visible work area

Platform responsibilities:

- provide the best available anchor
- report capability level honestly

Common-layer responsibilities:

- choose final popup coordinates
- apply display clamping and overflow handling

## 8. Restore And Write-Back Flow

The popup should not attempt to keep the original application focused while the user is entering instructions. Focus loss is expected.

The correct sequence is:

1. capture `SelectionContextCapture`
2. open prompt popup
3. user submits or cancels
4. if cancelled, stop
5. translate using provider
6. after translation completes, attempt `restoreSelectionTarget()`
7. if restore succeeds, attempt automatic write-back using existing safe write path
8. if restore fails or write-back cannot be safely verified, degrade to fallback popup + clipboard

The design intentionally delays restore until translation is finished. Restoring focus immediately after submit would return the user to the original app while the network translation is still pending, producing a more confusing experience.

## 9. Cross-Platform Strategy

This feature must be capability-driven rather than platform-branch-driven.

### 9.1 Windows

Expected to provide the strongest first implementation:

- often able to return `selection-rect` or `control-rect`
- often able to restore the prior target reliably
- can support the full flow of popup placement plus auto-write-back

### 9.2 macOS

May be able to provide strong anchor and restore behavior when Accessibility permissions are granted, but the contract must also allow weaker outcomes.

### 9.3 Linux

Must not assume reliable selection rectangles, focus restoration, or foreground-stealing behavior across X11 and Wayland. Linux implementations should be allowed to:

- return only `cursor` or `window-rect`
- report `canRestoreTargetAfterPrompt=false`
- force fallback-only write behavior after prompt submission

The runner should make decisions based on `capabilities`, not `process.platform`.

## 10. Result States And Errors

### 10.1 Workflow States

`context-translation` should clearly distinguish:

- `completed`
- `fallback-required`
- `cancelled`
- `failed`

`cancelled` is user-intentful termination and must not be treated as a platform error.

### 10.2 Error Codes

Add or formalize:

- `CONTEXT_INPUT_CANCELLED`
- `CONTEXT_PROMPT_UNAVAILABLE`
- `CONTEXT_PROMPT_SESSION_LOST`
- `RESTORE_TARGET_FAILED`
- `RESTORE_TARGET_UNSUPPORTED`
- `POPUP_ANCHOR_UNAVAILABLE`

Platform-specific diagnostics may include richer internal causes, but these must remain behind stable public error codes.

### 10.3 Diagnostics

For runtime status and diagnostic logs, include fields such as:

- `promptAnchorKind`
- `promptDisplayId`
- `restoreAttempted`
- `restoreSucceeded`
- `contextPromptCancelledBy`
- `contextPromptSessionId`

These fields are diagnostic metadata only and should not expose full selected text.

## 11. Files To Create Or Modify

### New Files

- `src/electron/services/context-prompt-session-service.ts`
- `src/electron/services/context-prompt-window-service.ts` or equivalent focused popup-window helper
- `src/renderer/services/context-prompt-api.ts`
- `src/shared/types/context-prompt.ts`

### Modified Files

- `src/electron/main.ts`
- `src/electron/preload.ts`
- `src/electron/security/expose-settings-api.ts`
- `src/electron/ipc/register-settings-ipc.ts` or a dedicated prompt IPC registrar
- `src/electron/services/context-translation-runner.ts`
- `src/electron/services/system-interaction-service.ts`
- `src/electron/platform/win32/adapter.ts`
- `src/renderer/app/App.tsx`
- `src/renderer/pages/context-popup-page.tsx`
- `src/shared/constants/ipc.ts`
- `src/shared/types/ipc.ts`

## 12. Testing Strategy

### 12.1 Runner Tests

- submit instructions and continue translation
- allow empty instructions
- cancel with `CONTEXT_INPUT_CANCELLED`
- restore failure causes `fallback-required`
- raw captured text remains the write-back verification source

### 12.2 Main-Process Session Tests

- single active session enforcement
- submit resolves pending session
- cancel resolves pending session
- popup close resolves pending session as cancelled
- stale session cleanup after unexpected destruction

### 12.3 Renderer Tests

- textarea auto-focus
- `Enter` submits
- `Shift+Enter` inserts a newline instead of submitting
- `Esc` cancels
- cancel button cancels
- submit button submits

### 12.4 Placement Tests

- uses `selection-rect` when available
- falls back through anchor priority in order
- clamps to display work area

### 12.5 Manual Validation

At minimum validate:

- Windows Notepad
- Chromium `textarea`
- WPF `TextBox`
- one known fallback-only target such as terminal or IDE editor to ensure graceful degradation

## 13. Acceptance Criteria

- Invoking `context-translation` opens a real prompt popup instead of silently continuing
- Popup placement prefers the captured anchor and degrades predictably when anchor precision is weaker
- Submitting prompt input closes the popup and resumes translation
- The workflow attempts to restore the original target only after translation is ready
- Automatic write-back occurs only when the target can be safely restored and verified
- Failure to restore or write back leads to explicit fallback behavior rather than silent loss
- The design introduces stable cross-platform interfaces for anchor and restore capability instead of adding more Win32-only branching to business logic
