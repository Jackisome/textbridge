# Windows Text Translation Expansion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏当前标准控件成功路径的前提下，继续扩展 Windows 文本翻译能力，并把“标准可编辑控件”和“终端/IDE/复杂渲染目标”的处理策略明确分层。

**Architecture:** 继续保持 `core -> electron/services -> electron/platform/win32 -> native/win32-helper` 的边界不变。所有“目标识别、选区安全性、Windows API 读写能力”都收敛在 helper 与 win32 平台层；业务层只消费稳定的捕获/回写结果与结构化诊断，不感知具体控件实现。

**Tech Stack:** TypeScript, Electron, Vitest, C#/.NET 10, UI Automation, Win32 helper, JSON over stdio

---

## Scope Decision

本计划只覆盖一个子问题：**基于兼容矩阵推进 Windows 控件分层支持与验证闭环**。不包含 macOS/Linux、OCR、富文本格式保留，也不包含终端/IDE 的深度专用适配。

### Target Tiers

- **Tier A: 首版承诺范围，继续扩展并验证**
  - Windows 设置搜索框
  - WPF TextBox
  - Win32 Edit / RichEdit20W / RichEdit50W
  - WinForms TextBox / RichTextBox
- **Tier B: 观察样本，允许成功但不外推**
  - Chromium `<input>` / `<textarea>`
  - Electron 普通输入框
- **Tier C: fallback-only 或 blocked**
  - VS Code / IDE 编辑器
  - Windows Terminal / PowerShell / cmd 控制台
  - contenteditable / 富文本 DOM
  - 游戏、自绘控件、管理员窗口、密码框

### Expected Product Behavior

- Tier A：优先 `replace-selection`，失败后 `paste-translation`，再失败才 `popup-fallback`
- Tier B：允许 `replace-selection` 或 `paste-translation` 成功，但矩阵只记观察结果，不提升为承诺
- Tier C：不再把“回写失败”当成待修 bug；应尽快识别为 `fallback-only` 或 `blocked`

---

## File Map

### Existing Files Expected To Change

- `docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md`
  - 维护目标分层、结果标签与人工验证证据
- `docs/plans/2026-03-09-windows-helper-manual-validation.md`
  - 维护人工验证顺序与记录模板
- `native/win32-helper/Interop/AutomationFacade.cs`
  - 集中处理 UIA / Win32 控件快照、目标特征与可编辑状态
- `native/win32-helper/Services/CaptureTextService.cs`
  - 负责捕获前的稳定等待、降级路径与 secure/fallback-only 判定入口
- `native/win32-helper/Services/WriteTextService.cs`
  - 负责 replace-selection / paste-translation 的允许条件、fail-closed 校验与目标分类
- `native/win32-helper/Services/StdIoHost.cs`
  - 扩展 helper 响应日志摘要，输出目标类型/策略信息
- `src/electron/platform/win32/protocol.ts`
  - 若需要新增目标策略字段或 diagnostics 摘要字段，在这里扩展协议
- `src/electron/platform/win32/adapter.ts`
  - 负责把 helper 错误映射到平台层稳定结构
- `src/electron/platform/win32/helper-session-service.ts`
  - 汇总并落盘 helper 诊断摘要
- `src/electron/services/system-interaction-service.ts`
  - 保持 fallback 编排稳定；必要时只在这里接入“平台已判定 fallback-only”的结果

### Existing Tests Expected To Change

- `native/win32-helper/TextBridge.Win32Helper.Tests/CaptureTextServiceTests.cs`
- `native/win32-helper/TextBridge.Win32Helper.Tests/WriteTextServiceTests.cs`
- `src/electron/platform/win32/adapter.test.ts`
- `src/electron/platform/win32/helper-session-service.test.ts`
- `src/electron/services/system-interaction-service.test.ts`

### New Tests Or Fixtures That May Be Needed

- `native/win32-helper/TextBridge.Win32Helper.Tests/AutomationFacadeTargetProfileTests.cs`
  - 如果 `AutomationFacade` 的目标分类逻辑增长到值得独立测试
- `docs/plans/2026-03-19-windows-text-translation-expansion-plan.md`
  - 本计划文档本身

---

### Task 1: 固化目标分类与策略边界

**Files:**
- Modify: `docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md`
- Modify: `docs/plans/2026-03-09-windows-helper-manual-validation.md`
- Modify: `native/win32-helper/Interop/AutomationFacade.cs`
- Modify: `native/win32-helper/Services/WriteTextService.cs`
- Test: `native/win32-helper/TextBridge.Win32Helper.Tests/WriteTextServiceTests.cs`

- [ ] **Step 1: 写 failing test，固定“终端/IDE 选区不稳定目标不应继续尝试写回”**

```csharp
[Fact]
public async Task Rejects_replace_selection_for_fallback_only_targets()
{
    // 模拟 Code / Terminal 一类目标：
    // 目标可聚焦，但选区在写回前不稳定，helper 应尽快返回 fallback-only / unsupported。
}
```

- [ ] **Step 2: 运行测试，确认当前行为仍把这类目标当成普通写回失败**

Run: `npm run helper:test`
Expected: 新增测试 FAIL，现状仍返回 `WRITE_BACK_TARGET_MISMATCH` 或继续尝试 paste

- [ ] **Step 3: 在 `AutomationFacade` 中增加目标分类摘要**

建议字段：

```csharp
diagnostics["targetFamily"] = "standard-edit" | "browser-edit" | "terminal-like" | "ide-editor" | "secure-field";
diagnostics["fallbackOnly"] = true | false;
```

分类优先依据：

- `processName`
- `windowClassName`
- `framework`
- `controlType`
- 密码框/只读检测

- [ ] **Step 4: 在 `WriteTextService` 中对 `fallbackOnly` / `secure-field` 快速失败**

目标：

- `terminal-like`
- `ide-editor`
- `secure-field`

直接返回结构化失败，不再走“明知不稳定的 replace-selection/paste-translation 双尝试”。

- [ ] **Step 5: 运行 helper 测试确认转绿**

Run: `npm run helper:test`
Expected: PASS，且新增测试证明 Tier C 目标不再进入低收益写回重试

- [ ] **Step 6: 提交**

```bash
git add native/win32-helper/Interop/AutomationFacade.cs native/win32-helper/Services/WriteTextService.cs native/win32-helper/TextBridge.Win32Helper.Tests/WriteTextServiceTests.cs docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md docs/plans/2026-03-09-windows-helper-manual-validation.md
git commit -m "fix(win32-helper): classify fallback-only targets"
```

---

### Task 2: 补齐标准 Win32 / WPF 文本控件的安全替换能力

**Files:**
- Modify: `native/win32-helper/Interop/AutomationFacade.cs`
- Modify: `native/win32-helper/Services/WriteTextService.cs`
- Modify: `native/win32-helper/TextBridge.Win32Helper.Tests/CaptureTextServiceTests.cs`
- Modify: `native/win32-helper/TextBridge.Win32Helper.Tests/WriteTextServiceTests.cs`
- Test: `native/win32-helper/TextBridge.Win32Helper.Tests/AutomationFacadeTargetProfileTests.cs`

- [ ] **Step 1: 写 failing test，固定 RichEdit / WPF TextBox 的期望行为**

至少覆盖：

- `TextPattern` 有选区，`replace-selection` 成功
- `TextPattern` 空选区，自动回到 native/clipboard 读路径
- 多行 `CRLF/LF` 已归一化，不再误判
- 密码框明确拒绝捕获

- [ ] **Step 2: 跑测试，确认当前至少有一部分场景失败**

Run: `npm run helper:test`
Expected: FAIL，证明测试覆盖到了当前空缺

- [ ] **Step 3: 扩展 `AutomationFacade` 的标准控件快照能力**

优先顺序：

1. `TextPattern`
2. native Edit / RichEdit 快照
3. 只在无法安全映射时退回 clipboard，而不是整框覆盖

补充字段：

- `valuePatternAvailable`
- `nativeEditSelectionAvailable`
- `selectionPrefixTextLength`
- `selectionSuffixTextLength`
- `targetFamily`

- [ ] **Step 4: 保持 `WriteTextService` 的 fail-closed 语义**

约束：

- 只要 `expectedSourceText` 与当前选区不一致，就失败
- 只要无法重建 `prefix + selection + suffix == value`，就失败
- 不得为通过测试而引入整框覆盖捷径

- [ ] **Step 5: 跑 helper 测试验证**

Run: `npm run helper:test`
Expected: PASS，标准控件路径全部转绿

- [ ] **Step 6: 提交**

```bash
git add native/win32-helper/Interop/AutomationFacade.cs native/win32-helper/Services/WriteTextService.cs native/win32-helper/TextBridge.Win32Helper.Tests/CaptureTextServiceTests.cs native/win32-helper/TextBridge.Win32Helper.Tests/WriteTextServiceTests.cs
git commit -m "feat(win32-helper): extend standard control replacement"
```

---

### Task 3: 把 helper 目标策略透出到平台日志与执行报告

**Files:**
- Modify: `native/win32-helper/Services/StdIoHost.cs`
- Modify: `src/electron/platform/win32/protocol.ts`
- Modify: `src/electron/platform/win32/adapter.ts`
- Modify: `src/electron/platform/win32/helper-session-service.ts`
- Modify: `src/electron/platform/win32/helper-session-service.test.ts`
- Modify: `src/electron/platform/win32/adapter.test.ts`

- [ ] **Step 1: 写 failing test，要求日志摘要里能直接看到目标分类与策略**

示例断言：

```ts
expect(logLine).toContain('targetFamily=terminal-like')
expect(logLine).toContain('fallbackOnly=true')
```

- [ ] **Step 2: 运行相关 Vitest，确认当前日志还没有这些信号**

Run: `pnpm vitest run src/electron/platform/win32/helper-session-service.test.ts src/electron/platform/win32/adapter.test.ts`
Expected: FAIL，当前摘要还不足以支持矩阵判断

- [ ] **Step 3: 扩展 helper 响应 diagnostics 与平台层映射**

新增摘要优先级：

- `targetFamily`
- `fallbackOnly`
- `secureField`
- `textComparisonMode`
- `selectionMatchedExpected`
- `verificationMethod`

- [ ] **Step 4: 跑 Vitest 验证**

Run: `pnpm vitest run src/electron/platform/win32/helper-session-service.test.ts src/electron/platform/win32/adapter.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/electron/platform/win32/protocol.ts src/electron/platform/win32/adapter.ts src/electron/platform/win32/adapter.test.ts src/electron/platform/win32/helper-session-service.ts src/electron/platform/win32/helper-session-service.test.ts native/win32-helper/Services/StdIoHost.cs
git commit -m "feat(win32): surface target strategy diagnostics"
```

---

### Task 4: 维护业务层 fallback 语义，避免把 Tier C 目标当故障处理

**Files:**
- Modify: `src/electron/services/system-interaction-service.ts`
- Modify: `src/electron/services/system-interaction-service.test.ts`
- Modify: `src/electron/services/quick-translation-runner.ts`
- Modify: `src/electron/services/quick-translation-runner.test.ts`
- Modify: `src/electron/services/context-translation-runner.ts`
- Modify: `src/electron/services/context-translation-runner.test.ts`

- [ ] **Step 1: 写 failing test，要求 fallback-only 目标直接走 popup/clipboard，不再多次无效写回**

示例：

```ts
it('falls back immediately for fallback-only targets', async () => {
  // helper 返回 structured diagnostics: fallbackOnly=true
  // 期望：主流程不再继续 retry write-back
})
```

- [ ] **Step 2: 跑相关 Vitest，确认当前仍会 retry**

Run: `pnpm vitest run src/electron/services/system-interaction-service.test.ts src/electron/services/quick-translation-runner.test.ts src/electron/services/context-translation-runner.test.ts`
Expected: FAIL

- [ ] **Step 3: 在业务层只接入“策略结果”，不引入 Windows 细节**

规则：

- 如果平台层已判定 `fallbackOnly=true`，直接走 `popup-fallback`
- 不在 `quick/context runner` 中写 `processName === 'Code'` 之类平台判断

- [ ] **Step 4: 跑 Vitest 验证**

Run: `pnpm vitest run src/electron/services/system-interaction-service.test.ts src/electron/services/quick-translation-runner.test.ts src/electron/services/context-translation-runner.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/electron/services/system-interaction-service.ts src/electron/services/system-interaction-service.test.ts src/electron/services/quick-translation-runner.ts src/electron/services/quick-translation-runner.test.ts src/electron/services/context-translation-runner.ts src/electron/services/context-translation-runner.test.ts
git commit -m "fix(workflow): respect fallback-only platform targets"
```

---

### Task 5: 按矩阵执行人工验证并回写证据

**Files:**
- Modify: `docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md`
- Modify: `docs/plans/2026-03-09-windows-helper-manual-validation.md`

- [ ] **Step 1: 先跑自动化回归**

Run:

```powershell
npm run helper:test
pnpm vitest run src/electron/platform/win32/helper-session-service.test.ts src/electron/platform/win32/adapter.test.ts src/electron/services/system-interaction-service.test.ts src/electron/services/quick-translation-runner.test.ts src/electron/services/context-translation-runner.test.ts
npm run build
```

Expected: 全部 PASS

- [ ] **Step 2: 按矩阵优先级做人肉验证**

顺序固定为：

1. 系统设置搜索框
2. WPF TextBox
3. Win32 RichEdit20W/50W
4. VS Code / Terminal 负向样本

- [ ] **Step 3: 对每个目标记录统一证据**

模板：

```text
Target:
Window title / class:
Control type:
Selected text:
Shortcut:
Observed result:
Runtime helper state:
Main log excerpt:
Helper log excerpt:
Final label:
Notes:
```

- [ ] **Step 4: 更新矩阵**

要求：

- `Pass` 只在多次稳定验证后填写
- `Fallback` 与 `Blocked` 必须写清具体 `errorCode` / `targetFamily`
- 对终端/IDE 目标明确标记为 `fallback-only` 或 `Not Promised`

- [ ] **Step 5: 提交**

```bash
git add docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md docs/plans/2026-03-09-windows-helper-manual-validation.md
git commit -m "docs(validation): record windows target matrix results"
```

---

## Validation Strategy Summary

### Success Criteria

- Tier A 目标在日志中可观察到稳定的：
  - `selectionMatchedExpected=true`
  - `targetStable=true`
  - `valueChanged=true`
  - `translatedTextDetected=true`
- Tier C 目标不再反复走“明知会失败的写回重试”
- 运行状态面板与主日志足够直接地解释“为什么这个目标只能 fallback”

### Explicit Non-Goals

- 不为 VS Code / Windows Terminal / PowerShell 终端做专用写回协议
- 不尝试恢复原剪贴板
- 不在本轮引入 IME 深度适配
- 不在本轮引入富文本样式保留

### Recommended Execution Order

1. Task 1
2. Task 3
3. Task 4
4. Task 2
5. Task 5

说明：

- 先把目标分类与日志打通，再改业务 fallback 语义，最后补标准控件能力，这样人工验证阶段不会继续陷入“有日志但没有策略结论”的状态。

---

Plan complete and saved to `docs/plans/2026-03-19-windows-text-translation-expansion-plan.md`. Ready to execute?
