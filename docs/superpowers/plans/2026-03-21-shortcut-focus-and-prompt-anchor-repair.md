# Shortcut Focus And Prompt Anchor Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate main-window focus theft during global shortcut workflows, place the context prompt popup near the captured target when possible, and improve Chromium omnibox prompt flows so they either restore and write back safely or degrade explicitly as fallback-only.

**Architecture:** Keep renderer prompt UI unchanged. Fixes stay in three layers: Electron main-process workflow launch, popup-window placement, and Win32 helper selection-context/restore behavior. Preserve the current capability-driven contract: prompt placement and post-prompt write-back only happen when the platform layer can prove they are safe.

**Tech Stack:** Electron, TypeScript, Vitest, .NET 10 Windows helper, UI Automation, JSON-over-stdio helper bridge

---

## File Structure

### New Files

- `src/electron/services/context-prompt-window-placement.ts`
  - Pure geometry helper that converts `PromptAnchor` + display work area into popup window bounds.
- `src/electron/services/context-prompt-window-placement.test.ts`
  - Geometry regression coverage for anchor-based placement and clamping.

### Modified Files

- `src/electron/main.ts`
  - Reattach main-window release protection before `quick-translation` and `context-translation`.
- `src/electron/services/window-focus-guard.ts`
  - Extend the existing guard into a reusable wrapper for foreground-safe workflow launch.
- `src/electron/services/window-focus-guard.test.ts`
  - Verify a visible main window is hidden before executing a shortcut workflow.
- `src/electron/services/context-prompt-window-service.ts`
  - Consume `PromptAnchor`, resolve popup bounds, and reposition an existing popup instead of always using the default center placement.
- `src/electron/services/context-prompt-window-service.test.ts`
  - Verify anchor-aware positioning on first open and on repeated open calls.
- `native/win32-helper/Interop/AutomationFacade.cs`
  - Improve selection-context metadata capture, clipboard-degraded prompt anchor derivation, and restore-target fidelity for Chromium address-bar-like flows.
- `native/win32-helper/Services/CaptureSelectionContextService.cs`
  - Stop returning `anchor=unknown`/`restoreTarget=null` for every clipboard fallback; include best-effort metadata when available.
- `native/win32-helper/Services/RestoreTargetService.cs`
  - Upgrade restore behavior from “foreground window only” to “window restore plus best-effort control refocus when the token contains control hints”.
- `native/win32-helper/Services/StdIoHost.cs`
  - Log richer diagnostics for selection-context metadata source and restore/refocus outcomes.
- `native/win32-helper/TextBridge.Win32Helper.Tests/CaptureSelectionContextServiceTests.cs`
  - Add clipboard-degraded metadata and omnibox-like target tests.
- `native/win32-helper/TextBridge.Win32Helper.Tests/RestoreTargetServiceTests.cs`
  - Add restore-token parsing and control-refocus tests.
- `src/electron/platform/win32/helper-session-service.ts`
  - Surface richer helper diagnostics into `diagnostic.log`.
- `src/electron/platform/win32/helper-session-service.test.ts`
  - Verify new diagnostic summary fields.
- `src/electron/services/system-interaction-service.test.ts`
  - Validate that richer selection-context metadata survives Electron-side mapping and fallback behavior.
- `src/electron/services/context-translation-runner.test.ts`
  - Add explicit coverage for fallback-only omnibox targets if helper still cannot guarantee restore/write-back.
- `docs/plans/2026-03-09-windows-helper-manual-validation.md`
  - Update manual validation steps and expected outcomes after the fixes land.
- `docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md`
  - Reclassify Chromium omnibox based on the post-fix result.
- `docs/README.zh-CN.md`
  - Refresh user-visible scope if prompt positioning / fallback-only semantics change materially.

---

## Task 1: Reattach Foreground Workflow Focus Guard

**Files:**
- Modify: `src/electron/main.ts`
- Modify: `src/electron/services/window-focus-guard.ts`
- Modify: `src/electron/services/window-focus-guard.test.ts`

- [ ] **Step 1: Write the failing focus-guard wrapper tests**

```ts
it('hides a visible main window before executing a global workflow', async () => {
  const calls: string[] = [];

  await runWithReleasedMainWindow(
    {
      isDestroyed: () => false,
      isVisible: () => true,
      hide: () => calls.push('hide')
    },
    async () => {
      calls.push('execute');
    },
    async (ms) => {
      calls.push(`wait:${ms}`);
    },
    120
  );

  expect(calls).toEqual(['hide', 'wait:120', 'execute']);
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npx vitest run src/electron/services/window-focus-guard.test.ts`
Expected: FAIL because the helper only exposes `releaseVisibleMainWindow()` and does not wrap workflow execution

- [ ] **Step 3: Implement the reusable wrapper and wire it into both global shortcut flows**

```ts
export async function runWithReleasedMainWindow<T>(
  mainWindow: MainWindowVisibilityController | null,
  execute: () => Promise<T>,
  wait: (ms: number) => Promise<void>,
  delayMs = 120
): Promise<T> {
  await releaseVisibleMainWindow(mainWindow, wait, delayMs);
  return execute();
}
```

```ts
void runWithReleasedMainWindow(
  windowService.getMainWindow(),
  () => runTranslationWorkflow('quick-translation', () => runner.run()),
  wait
);
```

- [ ] **Step 4: Re-run the focused tests and verify they pass**

Run: `npx vitest run src/electron/services/window-focus-guard.test.ts`
Expected: PASS

- [ ] **Step 5: Run the nearby workflow regression tests**

Run: `npx vitest run src/electron/services/quick-translation-runner.test.ts src/electron/services/context-translation-runner.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/electron/main.ts src/electron/services/window-focus-guard.ts src/electron/services/window-focus-guard.test.ts
git commit -m "fix(shortcuts): release visible main window before workflows"
```

---

## Task 2: Implement Anchor-Aware Prompt Window Placement

**Files:**
- Create: `src/electron/services/context-prompt-window-placement.ts`
- Create: `src/electron/services/context-prompt-window-placement.test.ts`
- Modify: `src/electron/services/context-prompt-window-service.ts`
- Modify: `src/electron/services/context-prompt-window-service.test.ts`

- [ ] **Step 1: Write the failing placement-geometry tests**

```ts
it('places the popup below a control anchor and clamps it into the display work area', () => {
  expect(
    resolveContextPromptWindowBounds({
      anchor: {
        kind: 'control-rect',
        bounds: { x: 100, y: 80, width: 400, height: 40 }
      },
      popupSize: { width: 480, height: 360 },
      workArea: { x: 0, y: 0, width: 1280, height: 720 }
    })
  ).toEqual({
    x: 100,
    y: 132,
    width: 480,
    height: 360
  });
});
```

- [ ] **Step 2: Write the failing window-service integration tests**

```ts
it('uses resolved anchor bounds when creating the popup window', async () => {
  const setBounds = vi.fn();
  const browserWindowFactory = vi.fn().mockReturnValue({
    loadURL: vi.fn().mockResolvedValue(undefined),
    show: vi.fn(),
    focus: vi.fn(),
    setBounds,
    isDestroyed: vi.fn().mockReturnValue(false),
    isMinimized: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    close: vi.fn()
  });
});
```

- [ ] **Step 3: Run the focused tests and confirm failure**

Run: `npx vitest run src/electron/services/context-prompt-window-placement.test.ts src/electron/services/context-prompt-window-service.test.ts`
Expected: FAIL because no placement helper exists and the window service ignores `anchor`

- [ ] **Step 4: Implement pure placement logic and inject the Electron screen dependency**

```ts
export function resolveContextPromptWindowBounds({
  anchor,
  popupSize,
  workArea,
  cursorPoint
}: ResolveContextPromptWindowBoundsOptions): Rectangle {
  // selection/control -> below, flip above if needed, clamp to work area
  // cursor -> near cursor
  // unknown -> centered in active display
}
```

```ts
const bounds = resolveContextPromptWindowBounds({
  anchor: options.anchor,
  popupSize: { width: 480, height: 360 },
  workArea
});

activeWindow = browserWindowFactory({
  ...createContextPromptWindowOptions(preloadPath),
  x: bounds.x,
  y: bounds.y
});
```

- [ ] **Step 5: Re-run the focused tests and verify they pass**

Run: `npx vitest run src/electron/services/context-prompt-window-placement.test.ts src/electron/services/context-prompt-window-service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/electron/services/context-prompt-window-placement.ts src/electron/services/context-prompt-window-placement.test.ts src/electron/services/context-prompt-window-service.ts src/electron/services/context-prompt-window-service.test.ts
git commit -m "fix(context-prompt): position popup from prompt anchors"
```

---

## Task 3: Preserve Anchor And Restore Metadata During Clipboard-Degraded Selection Capture

**Files:**
- Modify: `native/win32-helper/Interop/AutomationFacade.cs`
- Modify: `native/win32-helper/Services/CaptureSelectionContextService.cs`
- Modify: `native/win32-helper/TextBridge.Win32Helper.Tests/CaptureSelectionContextServiceTests.cs`
- Modify: `src/electron/platform/win32/helper-session-service.ts`
- Modify: `src/electron/platform/win32/helper-session-service.test.ts`
- Modify: `src/electron/services/system-interaction-service.test.ts`

- [ ] **Step 1: Write the failing helper tests for clipboard-degraded metadata**

```csharp
[Fact]
public async Task CaptureSelectionContext_ClipboardCaptureReturnsCursorOrWindowMetadataWhenTextWasCopied()
{
    var result = await service.CaptureAsync("clipboard");

    Assert.True(result.Ok);
    Assert.NotEqual("unknown", result.Anchor.Kind);
    Assert.NotNull(result.RestoreTargetToken);
}
```

- [ ] **Step 2: Write the failing helper-session diagnostic summary test**

```ts
it('includes anchor kind and restore metadata for clipboard-degraded selection-context responses', async () => {
  expect(logger.debug).toHaveBeenCalledWith(
    expect.stringContaining('anchorKind=cursor')
  );
});
```

- [ ] **Step 3: Run the focused tests and confirm failure**

Run: `npm run helper:test`
Expected: FAIL because clipboard selection-context capture always returns `anchor=unknown` and `restoreTarget=null`

Run: `npx vitest run src/electron/platform/win32/helper-session-service.test.ts src/electron/services/system-interaction-service.test.ts`
Expected: FAIL because no richer metadata is logged or mapped

- [ ] **Step 4: Implement best-effort metadata capture for clipboard fallback**

```csharp
if (string.Equals(method, "clipboard", StringComparison.OrdinalIgnoreCase))
{
    var captureResult = await _captureTextService.CaptureAsync("clipboard", cancellationToken);
    var metadata = _automationFacade.CapturePromptMetadataSnapshot();

    return captureResult.Ok
        ? SelectionContextCaptureResult.Success(
            "clipboard",
            captureResult.Text ?? string.Empty,
            metadata.Anchor,
            metadata.RestoreTargetToken,
            metadata.Capabilities,
            MergeDiagnostics(captureResult.Diagnostics, metadata.Diagnostics))
        : SelectionContextCaptureResult.Failure(...);
}
```

- [ ] **Step 5: Re-run the focused tests and verify they pass**

Run: `npm run helper:test`
Expected: PASS

Run: `npx vitest run src/electron/platform/win32/helper-session-service.test.ts src/electron/services/system-interaction-service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add native/win32-helper/Interop/AutomationFacade.cs native/win32-helper/Services/CaptureSelectionContextService.cs native/win32-helper/TextBridge.Win32Helper.Tests/CaptureSelectionContextServiceTests.cs src/electron/platform/win32/helper-session-service.ts src/electron/platform/win32/helper-session-service.test.ts src/electron/services/system-interaction-service.test.ts
git commit -m "fix(win32-helper): preserve prompt metadata during clipboard fallback"
```

---

## Task 4: Upgrade Restore Tokens And Refocus Behavior For Omnibox-Like Targets

**Files:**
- Modify: `native/win32-helper/Interop/AutomationFacade.cs`
- Modify: `native/win32-helper/Services/RestoreTargetService.cs`
- Modify: `native/win32-helper/Services/StdIoHost.cs`
- Modify: `native/win32-helper/TextBridge.Win32Helper.Tests/RestoreTargetServiceTests.cs`
- Modify: `native/win32-helper/TextBridge.Win32Helper.Tests/CaptureSelectionContextServiceTests.cs`
- Modify: `src/electron/platform/win32/helper-session-service.ts`
- Modify: `src/electron/platform/win32/helper-session-service.test.ts`
- Modify: `src/electron/services/context-translation-runner.test.ts`

- [ ] **Step 1: Write the failing helper tests for control-aware restore tokens**

```csharp
[Fact]
public async Task RestoreTarget_RestoresWindowAndAttemptsToRefocusCapturedControl()
{
    var result = await service.RestoreAsync(compositeToken);

    Assert.True(result.Ok);
    Assert.True(result.Restored);
    Assert.Equal(true, result.Diagnostics["controlRefocused"]?.GetValue<bool>());
}
```

- [ ] **Step 2: Write the failing runner regression for fallback-only omnibox handling**

```ts
it('keeps fallback-required when the helper can restore the window but cannot safely re-focus the original control', async () => {
  await expect(runner.run()).resolves.toMatchObject({
    workflow: 'context-translation',
    status: 'fallback-required',
    errorCode: 'WRITE_BACK_UNSUPPORTED'
  });
});
```

- [ ] **Step 3: Run the focused tests and confirm failure**

Run: `npm run helper:test`
Expected: FAIL because restore tokens only encode a window handle and restore only re-activates the window

Run: `npx vitest run src/electron/platform/win32/helper-session-service.test.ts src/electron/services/context-translation-runner.test.ts`
Expected: FAIL because no control-refocus diagnostics exist

- [ ] **Step 4: Implement composite restore tokens and control-refocus diagnostics**

```csharp
private static string CreateRestoreTargetToken(RestoreTargetDescriptor descriptor)
{
    return Convert.ToBase64String(
        Encoding.UTF8.GetBytes(JsonSerializer.Serialize(descriptor)));
}

public RestoreTargetResult RestoreTarget(string token)
{
    // restore foreground window
    // locate element by runtimeId / class hint inside that window
    // call AutomationElement.SetFocus() when safe
    // report foregroundRestored, controlRefocused, and refocusMethod
}
```

- [ ] **Step 5: Re-run the focused tests and verify they pass**

Run: `npm run helper:test`
Expected: PASS

Run: `npx vitest run src/electron/platform/win32/helper-session-service.test.ts src/electron/services/context-translation-runner.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add native/win32-helper/Interop/AutomationFacade.cs native/win32-helper/Services/RestoreTargetService.cs native/win32-helper/Services/StdIoHost.cs native/win32-helper/TextBridge.Win32Helper.Tests/RestoreTargetServiceTests.cs native/win32-helper/TextBridge.Win32Helper.Tests/CaptureSelectionContextServiceTests.cs src/electron/platform/win32/helper-session-service.ts src/electron/platform/win32/helper-session-service.test.ts src/electron/services/context-translation-runner.test.ts
git commit -m "fix(win32-helper): improve prompt restore for omnibox targets"
```

---

## Task 5: Full Verification, Manual Validation, And Docs Sync

**Files:**
- Modify: `docs/plans/2026-03-09-windows-helper-manual-validation.md`
- Modify: `docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md`
- Modify: `docs/README.zh-CN.md`

- [ ] **Step 1: Run focused app-side verification**

Run: `npx vitest run src/electron/services/window-focus-guard.test.ts src/electron/services/context-prompt-window-placement.test.ts src/electron/services/context-prompt-window-service.test.ts src/electron/services/context-translation-runner.test.ts src/electron/services/system-interaction-service.test.ts src/electron/platform/win32/helper-session-service.test.ts`
Expected: PASS

- [ ] **Step 2: Run helper verification**

Run: `npm run helper:test`
Expected: PASS

- [ ] **Step 3: Run project-wide verification**

Run: `npm run typecheck`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Execute manual validation matrix**

Run manual checks for:
- quick translation with the main TextBridge window visible: confirm no foreground steal and successful write-back in a standard target
- Notepad `context-translation`: popup appears near the selected control, submit restores target, and write-back succeeds
- Chromium `<textarea>` `context-translation`: popup appears near the field and either writes back safely or falls back with explicit diagnostics
- Chromium omnibox `context-translation`: determine final classification
  - if control refocus + write-back succeed, record as `Fallback` or `Pass` with precise scope
  - if control refocus is still unsafe, explicitly classify omnibox as `fallback-only`, do not keep forcing direct replace behavior

- [ ] **Step 5: Update docs to match the actual post-fix outcome**

Required updates:
- manual validation guide must no longer mention stale fallback assumptions
- compatibility matrix must separate Chromium `<textarea>` from omnibox
- README should mention prompt popup is real, and any remaining omnibox limitation must be described as a deliberate compatibility boundary, not an uninvestigated bug

- [ ] **Step 6: Commit**

```bash
git add docs/plans/2026-03-09-windows-helper-manual-validation.md docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md docs/README.zh-CN.md
git commit -m "docs: record focus and prompt placement validation"
```

---

## Notes For Implementers

- Do not treat Chromium `<textarea>` success as evidence that Chromium omnibox is also safely writable. Keep those targets separately classified until the helper proves otherwise.
- Do not “fix” omnibox by skipping post-prompt verification. If the original control cannot be safely restored, the correct behavior is explicit fallback, not blind paste.
- Keep popup placement logic pure and testable. Geometry math belongs in a small helper, not inline inside the BrowserWindow service.
- Keep platform-specific behavior inside the Win32 helper or `src/electron/platform/win32/`. Do not leak Chromium special cases into renderer code.
