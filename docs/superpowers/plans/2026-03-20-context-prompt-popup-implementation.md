# Context Prompt Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real `context-translation` prompt popup workflow that captures user instructions, places the popup near the original selection when possible, and restores the original target before safe automatic write-back.

**Architecture:** Keep prompt UI in Electron/renderer, add a dedicated main-process prompt session/window layer, and extend platform interaction with capability-driven `captureSelectionContext` and `restoreSelectionTarget` interfaces. Windows is the first concrete implementation, but the contracts must remain portable to `darwin` and `linux`.

**Tech Stack:** Electron, React 19, TypeScript, Vitest, .NET 10 Windows helper, UI Automation, JSON-over-stdio helper bridge

---

## File Structure

### New Files

- `src/shared/types/context-prompt.ts`
  - Shared prompt session, anchor, restore-target, and selection-context contracts
- `src/electron/services/context-prompt-session-service.ts`
  - Owns the single active prompt session and resolves submit/cancel
- `src/electron/services/context-prompt-session-service.test.ts`
  - Unit tests for session lifecycle
- `src/electron/services/context-prompt-window-service.ts`
  - Creates and controls the lightweight popup `BrowserWindow`
- `src/electron/services/context-prompt-window-service.test.ts`
  - Unit tests for popup window creation and lifecycle behavior
- `src/electron/ipc/register-context-prompt-ipc.ts`
  - Registers prompt-session IPC channels
- `src/renderer/services/context-prompt-api.ts`
  - Renderer wrapper for prompt session IPC
- `src/renderer/pages/context-popup-page.test.tsx`
  - Popup UI interaction tests
- `native/win32-helper/Services/CaptureSelectionContextService.cs`
  - Windows helper service that returns source text plus anchor and restore-target metadata
- `native/win32-helper/Services/RestoreTargetService.cs`
  - Windows helper service that attempts to restore the original target after translation
- `native/win32-helper/TextBridge.Win32Helper.Tests/CaptureSelectionContextServiceTests.cs`
  - Unit tests for Windows selection-context capture
- `native/win32-helper/TextBridge.Win32Helper.Tests/RestoreTargetServiceTests.cs`
  - Unit tests for restore-target behavior

### Modified Files

- `src/electron/main.ts`
  - Wire prompt session service, popup window service, IPC registrar, and runner integration
- `src/electron/preload.ts`
  - Expose prompt session APIs and active prompt session shape
- `src/electron/security/expose-settings-api.ts`
  - Extend the desktop API surface for prompt session methods
- `src/shared/constants/ipc.ts`
  - Add `contextPrompt:*` channel names
- `src/shared/types/ipc.ts`
  - Add runtime-facing prompt session state if needed by preload/renderer
- `src/shared/types/preload.ts`
  - Extend `TextBridgeApi` or sibling preload contract for prompt session operations
- `src/electron/services/context-translation-runner.ts`
  - Switch from stub prompt collection to real prompt session + restore flow
- `src/electron/services/context-translation-runner.test.ts`
  - Cover submit, cancel, restore failure, and fallback behavior
- `src/electron/services/system-interaction-service.ts`
  - Add `captureSelectionContext()` and `restoreSelectionTarget()`
- `src/electron/services/system-interaction-service.test.ts`
  - Cover capability-driven capture and restore semantics
- `src/electron/services/execution-report-service.ts`
  - Continue recording runtime entries for cancelled/fallback executions
- `src/electron/services/execution-report-service.test.ts`
  - Add cancelled execution coverage
- `src/core/entities/execution-report.ts`
  - Add `cancelled` execution status
- `src/electron/platform/win32/protocol.ts`
  - Add helper request/response shapes for selection-context capture and target restore
- `src/electron/platform/win32/adapter.ts`
  - Map richer helper responses to platform-neutral Electron contracts
- `src/electron/platform/win32/adapter.test.ts`
  - Verify new protocol mapping
- `src/electron/platform/win32/helper-session-service.ts`
  - Log richer diagnostics for anchor/restore results
- `src/electron/platform/win32/helper-session-service.test.ts`
  - Verify diagnostic extraction
- `src/renderer/app/App.tsx`
  - Route `context-popup` view through the real prompt API
- `src/renderer/pages/context-popup-page.tsx`
  - Replace static placeholder page with real submit/cancel/IME-safe behavior
- `src/renderer/features/popup-state.ts`
  - Add prompt session state helpers if still useful after wiring
- `src/renderer/features/popup-state.test.ts`
  - Update or extend popup state tests
- `src/renderer/types/vite-env.d.ts`
  - Extend `window` typings for prompt session APIs/contracts
- `src/renderer/app/styles.css`
  - Refine popup sizing and lightweight interaction styling
- `native/win32-helper/Program.cs`
  - Register new helper services and routes
- `native/win32-helper/Protocols/HelperRequest.cs`
  - Add request DTOs for selection-context capture and restore-target
- `native/win32-helper/Protocols/HelperResponse.cs`
  - Add response DTOs for anchor/capability/restore diagnostics
- `native/win32-helper/Interop/AutomationFacade.cs`
  - Surface anchor bounds, focused-element metadata, and restore tokens
- `native/win32-helper/Services/StdIoHost.cs`
  - Route new helper commands and log structured diagnostics

## Task 1: Shared Contracts And Prompt Session Service

**Files:**
- Create: `src/shared/types/context-prompt.ts`
- Create: `src/electron/services/context-prompt-session-service.ts`
- Create: `src/electron/services/context-prompt-session-service.test.ts`
- Modify: `src/shared/constants/ipc.ts`
- Modify: `src/shared/types/ipc.ts`

- [ ] **Step 1: Write the failing prompt session tests**

```ts
it('keeps a single active prompt session and resolves submit', async () => {
  const service = createContextPromptSessionService();
  const pending = service.open({
    sourceText: 'world',
    anchor: { kind: 'cursor' }
  });

  service.submit({
    instructions: 'Use concise business English.'
  });

  await expect(pending).resolves.toEqual({
    status: 'submitted',
    instructions: 'Use concise business English.'
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npx vitest run src/electron/services/context-prompt-session-service.test.ts`
Expected: FAIL because the service/types do not exist yet

- [ ] **Step 3: Implement shared prompt contracts and the minimal session service**

```ts
export interface PromptAnchor {
  kind: 'selection-rect' | 'control-rect' | 'window-rect' | 'cursor' | 'unknown';
  bounds?: { x: number; y: number; width: number; height: number };
  displayId?: string;
}

export function createContextPromptSessionService() {
  let activeSession: PromptSession | null = null;
  // open / getActive / submit / cancel / clear
}
```

- [ ] **Step 4: Re-run the tests and verify they pass**

Run: `npx vitest run src/electron/services/context-prompt-session-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/types/context-prompt.ts src/shared/constants/ipc.ts src/shared/types/ipc.ts src/electron/services/context-prompt-session-service.ts src/electron/services/context-prompt-session-service.test.ts
git commit -m "feat(context-prompt): add prompt session contracts"
```

## Task 2: Popup Window Service And Prompt IPC

**Files:**
- Create: `src/electron/services/context-prompt-window-service.ts`
- Create: `src/electron/services/context-prompt-window-service.test.ts`
- Create: `src/electron/ipc/register-context-prompt-ipc.ts`
- Modify: `src/electron/preload.ts`
- Modify: `src/electron/security/expose-settings-api.ts`
- Modify: `src/shared/types/preload.ts`
- Modify: `src/electron/main.ts`

- [ ] **Step 1: Write failing tests for popup window creation and IPC submit/cancel plumbing**

```ts
it('opens a skip-taskbar popup window for the active prompt session', async () => {
  const service = createContextPromptWindowService({ browserWindowFactory });
  await service.open({ sessionId: 'prompt-1', anchor: { kind: 'cursor' } });
  expect(browserWindowFactory).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npx vitest run src/electron/services/context-prompt-window-service.test.ts`
Expected: FAIL because the window service and prompt IPC registrar do not exist yet

- [ ] **Step 3: Implement the popup window service and prompt IPC registrar**

```ts
ipcMain.handle(IPC_CHANNELS.contextPrompt.getSession, () =>
  promptSessionService.getActiveSession()
);

ipcMain.handle(IPC_CHANNELS.contextPrompt.submit, (_event, payload) =>
  promptSessionService.submit(payload)
);
```

- [ ] **Step 4: Re-run the tests and verify they pass**

Run: `npx vitest run src/electron/services/context-prompt-window-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/electron/services/context-prompt-window-service.ts src/electron/services/context-prompt-window-service.test.ts src/electron/ipc/register-context-prompt-ipc.ts src/electron/preload.ts src/electron/security/expose-settings-api.ts src/shared/types/preload.ts src/electron/main.ts
git commit -m "feat(context-prompt): add popup window and ipc"
```

## Task 3: Renderer Prompt API And Popup Page

**Files:**
- Create: `src/renderer/services/context-prompt-api.ts`
- Create: `src/renderer/pages/context-popup-page.test.tsx`
- Modify: `src/renderer/pages/context-popup-page.tsx`
- Modify: `src/renderer/app/App.tsx`
- Modify: `src/renderer/types/vite-env.d.ts`
- Modify: `src/renderer/app/styles.css`

- [ ] **Step 1: Write failing renderer tests for submit, cancel, IME-safe Enter, and Shift+Enter**

```tsx
it('submits with Enter when not composing and inserts newline with Shift+Enter', async () => {
  render(<ContextPopupPage />);
  // simulate input, Enter submit, Shift+Enter newline, Esc cancel
});
```

- [ ] **Step 2: Run the renderer tests and confirm failure**

Run: `npx vitest run src/renderer/pages/context-popup-page.test.tsx src/renderer/app/App.test.tsx`
Expected: FAIL because the popup page is still static

- [ ] **Step 3: Implement the renderer prompt API and interactive popup page**

```tsx
function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.nativeEvent.isComposing) return;
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void submit();
  }
}
```

- [ ] **Step 4: Re-run the renderer tests and verify they pass**

Run: `npx vitest run src/renderer/pages/context-popup-page.test.tsx src/renderer/app/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/services/context-prompt-api.ts src/renderer/pages/context-popup-page.tsx src/renderer/pages/context-popup-page.test.tsx src/renderer/app/App.tsx src/renderer/types/vite-env.d.ts src/renderer/app/styles.css
git commit -m "feat(context-prompt): wire popup renderer interactions"
```

## Task 4: Electron System Interaction Contracts For Selection Context And Restore

**Files:**
- Modify: `src/electron/services/system-interaction-service.ts`
- Modify: `src/electron/services/system-interaction-service.test.ts`
- Modify: `src/core/entities/execution-report.ts`
- Modify: `src/electron/services/execution-report-service.ts`
- Modify: `src/electron/services/execution-report-service.test.ts`
- Modify: `src/shared/types/context-prompt.ts`

- [ ] **Step 1: Write failing tests for `captureSelectionContext()`, `restoreSelectionTarget()`, and cancelled execution state**

```ts
it('returns fallback-required when restore fails after prompt submission', async () => {
  // arrange translated text ready, restore false, expect fallback-required
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npx vitest run src/electron/services/system-interaction-service.test.ts src/electron/services/execution-report-service.test.ts`
Expected: FAIL because the richer interaction surface and `cancelled` status do not exist yet

- [ ] **Step 3: Implement the richer system interaction methods and execution status**

```ts
export type ExecutionStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'fallback-required'
  | 'cancelled';
```

- [ ] **Step 4: Re-run the tests and verify they pass**

Run: `npx vitest run src/electron/services/system-interaction-service.test.ts src/electron/services/execution-report-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/electron/services/system-interaction-service.ts src/electron/services/system-interaction-service.test.ts src/core/entities/execution-report.ts src/electron/services/execution-report-service.ts src/electron/services/execution-report-service.test.ts src/shared/types/context-prompt.ts
git commit -m "feat(context-prompt): add selection context contracts"
```

## Task 5: Win32 Adapter, Protocol, And Helper Support

**Files:**
- Modify: `src/electron/platform/win32/protocol.ts`
- Modify: `src/electron/platform/win32/adapter.ts`
- Modify: `src/electron/platform/win32/adapter.test.ts`
- Modify: `src/electron/platform/win32/helper-session-service.ts`
- Modify: `src/electron/platform/win32/helper-session-service.test.ts`
- Modify: `native/win32-helper/Program.cs`
- Modify: `native/win32-helper/Protocols/HelperRequest.cs`
- Modify: `native/win32-helper/Protocols/HelperResponse.cs`
- Modify: `native/win32-helper/Interop/AutomationFacade.cs`
- Create: `native/win32-helper/Services/CaptureSelectionContextService.cs`
- Create: `native/win32-helper/Services/RestoreTargetService.cs`
- Modify: `native/win32-helper/Services/StdIoHost.cs`
- Create: `native/win32-helper/TextBridge.Win32Helper.Tests/CaptureSelectionContextServiceTests.cs`
- Create: `native/win32-helper/TextBridge.Win32Helper.Tests/RestoreTargetServiceTests.cs`

- [ ] **Step 1: Write failing TypeScript and helper tests for selection-context capture and restore-target requests**

```ts
expect(await adapter.captureSelectionContext()).toEqual({
  success: true,
  data: {
    sourceText: 'world',
    anchor: { kind: 'selection-rect', bounds: { x: 10, y: 10, width: 40, height: 20 } },
    restoreTarget: { platform: 'win32', token: 'hwnd:123' }
  }
});
```

```csharp
[Fact]
public async Task CaptureSelectionContext_ReturnsSelectionRectAndRestoreToken() { }
```

- [ ] **Step 2: Run both TS and helper tests to verify failure**

Run: `npx vitest run src/electron/platform/win32/adapter.test.ts src/electron/platform/win32/helper-session-service.test.ts`
Expected: FAIL due to missing protocol/service support

Run: `npm run helper:test`
Expected: FAIL due to missing helper commands and tests

- [ ] **Step 3: Implement the new Win32 protocol, adapter mapping, and helper services**

```ts
type Win32RequestKind =
  | 'capture-text'
  | 'write-text'
  | 'clipboard-write'
  | 'capture-selection-context'
  | 'restore-target';
```

```csharp
if (request.Kind == "restore-target")
{
    return _restoreTargetService.Handle(request);
}
```

- [ ] **Step 4: Re-run the focused TS and helper tests and verify they pass**

Run: `npx vitest run src/electron/platform/win32/adapter.test.ts src/electron/platform/win32/helper-session-service.test.ts`
Expected: PASS

Run: `npm run helper:test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/electron/platform/win32/protocol.ts src/electron/platform/win32/adapter.ts src/electron/platform/win32/adapter.test.ts src/electron/platform/win32/helper-session-service.ts src/electron/platform/win32/helper-session-service.test.ts native/win32-helper/Program.cs native/win32-helper/Protocols/HelperRequest.cs native/win32-helper/Protocols/HelperResponse.cs native/win32-helper/Interop/AutomationFacade.cs native/win32-helper/Services/CaptureSelectionContextService.cs native/win32-helper/Services/RestoreTargetService.cs native/win32-helper/Services/StdIoHost.cs native/win32-helper/TextBridge.Win32Helper.Tests/CaptureSelectionContextServiceTests.cs native/win32-helper/TextBridge.Win32Helper.Tests/RestoreTargetServiceTests.cs
git commit -m "feat(win32-helper): capture prompt anchors and restore targets"
```

## Task 6: Context Translation Runner Integration

**Files:**
- Modify: `src/electron/services/context-translation-runner.ts`
- Modify: `src/electron/services/context-translation-runner.test.ts`
- Modify: `src/electron/main.ts`

- [ ] **Step 1: Write failing runner tests for submit, cancel, restore-after-translation, and fallback-required**

```ts
it('returns cancelled when the prompt session is cancelled', async () => {
  await expect(runner.run()).resolves.toMatchObject({
    workflow: 'context-translation',
    status: 'cancelled',
    errorCode: 'CONTEXT_INPUT_CANCELLED'
  });
});
```

- [ ] **Step 2: Run the runner tests and confirm failure**

Run: `npx vitest run src/electron/services/context-translation-runner.test.ts`
Expected: FAIL because the runner still depends on the stub popup flow

- [ ] **Step 3: Implement runner orchestration around prompt session and restore**

```ts
const selectionContext = await systemInteractionService.captureSelectionContext(settings);
const promptResult = await contextPromptSessionService.request({
  sourceText: selectionContext.data.sourceText,
  anchor: selectionContext.data.anchor
});
```

- [ ] **Step 4: Re-run the runner tests and verify they pass**

Run: `npx vitest run src/electron/services/context-translation-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/electron/services/context-translation-runner.ts src/electron/services/context-translation-runner.test.ts src/electron/main.ts
git commit -m "feat(context-translation): integrate prompt popup workflow"
```

## Task 7: Full Verification, Manual Validation, And Docs Sync

**Files:**
- Modify: `docs/plans/2026-03-09-windows-helper-manual-validation.md`
- Modify: `docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md`
- Modify: `docs/README.zh-CN.md` if user-visible scope/status needs updating

- [ ] **Step 1: Run targeted app-side verification**

Run: `npx vitest run src/electron/services/context-prompt-session-service.test.ts src/electron/services/context-prompt-window-service.test.ts src/electron/services/context-translation-runner.test.ts src/electron/services/system-interaction-service.test.ts src/electron/platform/win32/adapter.test.ts src/electron/platform/win32/helper-session-service.test.ts src/renderer/pages/context-popup-page.test.tsx src/electron/services/execution-report-service.test.ts`
Expected: PASS

- [ ] **Step 2: Run helper verification**

Run: `npm run helper:test`
Expected: PASS

- [ ] **Step 3: Run project-wide type/build verification**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Execute manual validation matrix**

Run manual checks for:
- Notepad selection with prompt submit and successful restore/write-back
- Chromium `textarea` selection with prompt submit and successful restore/write-back
- one restore-failure sample that degrades to fallback popup
- one fallback-only target such as terminal/IDE editor to verify explicit downgrade behavior

- [ ] **Step 5: Update docs and commit**

```bash
git add docs/plans/2026-03-09-windows-helper-manual-validation.md docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md docs/README.zh-CN.md
git commit -m "docs: record context prompt popup validation"
```
