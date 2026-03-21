# Windows Helper Manual Validation

**Date:** 2026-03-21  
**Audience:** 开发者、本地联调、兼容性验证执行人

## Goal

用可重复的本地步骤验证这条闭环是否成立：

1. 全局快捷键触发
2. helper 启动并响应
3. 选中文本被捕获
4. mock provider 返回可预测译文
5. 结果被写回，或至少进入 popup fallback 并写入剪贴板
6. 有足够日志判断失败位置

## Latest Verified Baseline

- `2026-03-18` Chrome `<textarea>`：已验证 `replace-selection` 成功，属于观察样本，不外推到其他 Chromium 输入控件
- `2026-03-19` Windows 记事本：已验证 `replace-selection` 成功，且两次独立触发都通过，可作为当前 Win32 标准控件基线
- `2026-03-21` `context-translation` 独立 prompt 浮窗已接入真实主流程，自动化验证通过；三个修复均已落地：
  - 主窗口焦点回归（`b588805`）
  - 锚点感知窗口定位（`2edddbd`）
  - Clipboard 降级保留元数据（`e7aaa80`）和 Omnibox 复合 restore token + 控制 refocus（`7a5b0fd`）
- Chromium 地址栏样本仍为 fallback-only，不在自动回写承诺范围
- 当前下一轮优先目标：`系统设置搜索框`、`WPF TextBox`、`Win32 RichEdit20W/50W`

## Preconditions

- 操作系统：Windows
- `.NET SDK` 已安装
- 开发模式优先使用 `mock` provider
- 当前项目基于 worktree `feature/windows-text-translation-client`

## Commands

### 1. 运行 TypeScript 与 .NET 自动化验证

```powershell
npx vitest run src/electron/platform/common/helper-protocol.test.ts src/electron/platform/common/stdio-json-client.test.ts src/electron/platform/win32/helper-path.test.ts src/electron/platform/win32/helper-session-service.test.ts src/electron/platform/win32/adapter.test.ts src/electron/services/execution-report-service.test.ts src/electron/services/diagnostic-log-service.test.ts src/electron/services/settings-service.test.ts src/electron/services/system-interaction-service.test.ts src/electron/ipc/register-settings-ipc.test.ts src/electron/services/quick-translation-runner.test.ts src/electron/services/context-translation-runner.test.ts src/electron/services/shortcut-service.test.ts src/renderer/features/runtime-status/runtime-status-panel.test.tsx src/renderer/pages/settings-page.test.tsx
```

```powershell
& 'C:/Program Files/dotnet/dotnet.exe' test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj
```

### 2. 启动开发环境

```powershell
npm run dev
```

启动后应看到：

- Electron 主进程已编译
- Renderer 已启动在 `http://127.0.0.1:5173`
- 应用主窗口可打开设置页

## Runtime Panel Checks

打开设置页后，先确认运行状态面板至少包含：

- 当前 Provider
- 平台
- 已注册快捷键
- Helper 状态
- 最近 Helper 错误
- Helper PID
- 最近执行记录

预期：

- 应用刚启动但未触发 helper 前，`helperState` 通常为 `idle`
- 第一次触发快捷键后，若 helper 成功启动，应变为 `ready`
- 若 helper 超时或子进程异常退出，应变为 `degraded` 或 `stopped`

## Log Locations

### Main process diagnostic log

位于 `app.getPath('userData')/logs/diagnostic.log`。

开发时常见关键行：

- `win32 helper session is ready`
- `win32-helper stderr: ...`
- `Settings saved and shortcuts reapplied.`
- `<workflow> failed: ...`

### Helper diagnostic log

开发模式默认位于：

`native/win32-helper/bin/Debug/net10.0-windows/logs/win32-helper.log`

常见关键行：

- `Starting helper host.`
- `Handling request 'health-check' (...)`
- `Handling request 'capture-text' (...)`
- `Handling request 'write-text' (...)`
- `Handling request 'clipboard-write' (...)`

## Recommended Functional Validation Order

### 1. Helper health-check smoke

先确认 helper 本身能独立返回结构化响应：

```powershell
'{"id":"req-1","kind":"health-check","timestamp":"2026-03-10T00:00:00.000Z","payload":{}}' | & 'C:/Program Files/dotnet/dotnet.exe' run --project native/win32-helper/TextBridge.Win32Helper.csproj
```

预期：

- `stdout` 有一条 `ok: true` 的 JSON
- `payload.capabilities` 至少包含 `health-check`
- `stderr` 有 helper 启动和请求处理日志

### 2. Clipboard-write smoke

```powershell
'{"id":"req-2","kind":"clipboard-write","timestamp":"2026-03-10T00:00:00.000Z","payload":{"text":"translated"}}' | & 'C:/Program Files/dotnet/dotnet.exe' run --project native/win32-helper/TextBridge.Win32Helper.csproj
```

预期：

- `stdout` 返回 `kind: "clipboard-write"` 且 `ok: true`
- 剪贴板文本被更新为 `translated`

### 3. 记事本闭环验证（已通过）

1. 启动 TextBridge，设置 Provider 为 `mock`
2. 打开 Windows 记事本
3. 输入 `hello world`
4. 只选中 `world`
5. 触发快速翻译快捷键

预期结果优先级：

- 首选：原输入框被写回
- 次选：自动写回失败，但 popup fallback 触发，剪贴板中可见 `[Mock] world`

运行结束后检查：

- 运行状态面板新增一条 recent execution
- `captureMethod` 为 `uia` 或 `clipboard`
- `writeBackMethod` 为 `replace-selection` / `paste-translation` / `popup-fallback`
- 若失败，能看到明确 `errorCode`

当前基线记录：

- `2026-03-19` 已观察到两次 `capture-text(method=uia)` 成功后，直接 `write-text(method=replace-selection)` 成功
- 主日志关键行显示：`processName=Notepad`、`framework=Win32`、`selectionMatchedExpected=true`、`targetStable=true`、`valueChanged=true`、`translatedTextDetected=true`

### 4. 系统设置搜索框验证

1. 打开 Windows 设置
2. 在搜索框输入 `hello world`
3. 只选中 `world`
4. 触发快速翻译快捷键

预期：

- 优先观察是否直接 `replace-selection`
- 若失败，至少应保留结构化失败信息，不应静默无结果
- 重点记录 `framework`、`windowClassName`、`controlType`

### 5. 无选区负向验证

1. 打开标准输入框
2. 输入文本但不要选择任何字符
3. 触发快速翻译快捷键

预期：

- 捕获失败
- `errorCode` 倾向为 `TEXT_CAPTURE_NO_SELECTION`
- recent execution 状态为 `failed`

### 6. 权限不匹配负向验证

1. 以管理员身份启动一个目标窗口
2. 保持 TextBridge 为普通权限
3. 在该窗口输入并选中文本
4. 触发快捷键

预期：

- 不应静默成功
- recent execution 或日志里应有结构化失败信息
- compatibility matrix 记录为 `Blocked`

## Expected Mock Output

使用 `mock` provider 时，返回文本形如：

```text
[Mock] hello world
```

这能帮助你区分“provider 返回值正确”和“写回链路是否正确”。

## Failure Triage

### 快捷键没反应

优先检查：

- 设置页显示的已注册快捷键
- `shortcutService.applySettings()` 是否在保存设置后被重新执行
- recent execution 是否完全没有新记录

### helper 没起来

优先检查：

- 运行状态面板中的 `helperState`
- `diagnostic.log` 中是否有 helper session ready / timeout / unavailable
- 当前环境是否能定位 `dotnet`

### capture 失败

优先检查 helper 日志中的：

- `Handling request 'capture-text'`
- diagnostics 里的 `apiAttempted`
- diagnostics 里的 `windowClassName` / `processName`

### write-back 失败

优先检查：

- 是否先收到 `replace-selection` 失败再退到 `paste-translation`
- 若最终退到 popup fallback，剪贴板是否保留结果
- 若是多行文本目标，额外检查 diagnostics 里的 `textComparisonMode=line-ending-normalized`，避免把 `CRLF/LF` 差异误判为真实写回失败

## 2026-03-21 Manual Validation Notes

### Context Prompt Popup

- 已确认 `context-translation` 现在会打开真实的独立 prompt 浮窗，不再是旧版”空上下文继续翻译”的 stub
- **已修复 - 焦点回归**: `quick-translation` 和 `context-translation` 快捷键处理器现在都在工作流执行前释放主窗口可见性，防止 TextBridge 主窗口在捕获成功后抢占前台焦点（commit `b588805`）
- **已修复 - 锚点定位**: `context-prompt-window-service` 现在真正消费 `PromptAnchor`，基于 `selection-rect` / `control-rect` / `cursor` 实现窗口定位，而不是默认居中（commit `2edddbd`）
- **已修复 - 剪贴板元数据**: `clipboard` 降级路径现在返回 `cursor` 或 `window-rect` 锚点而非 `unknown`，并包含 `restoreTarget` token（commit `e7aaa80`）
- **已修复 - Omnibox 恢复**: `RestoreTarget` 现在解析复合 restore token（含 runtimeId / className 提示），并尝试通过 UI Automation 重新聚焦原始控件，报告 `controlRefocused` 和 `refocusMethod`（commit `7a5b0fd`）

### Chromium Omnibox 分类说明

- Chromium 地址栏在 `context-translation` 中当前仍为 **fallback-only** 样本，不在自动回写承诺范围内
- 修复后，helper 现在会报告 `anchorKind=cursor` 或 `window-rect`（而非 `unknown`），且包含有效的 `restoreTarget` token
- Omnibox 的 control refocus 在某些 Chromium 版本中可能因渲染进程隔离而不可靠，最终行为仍可能退化为剪贴板 / popup fallback
- 不要把 Chromium `<textarea>` 的成功外推到 omnibox

### Recorded Follow-Up Actions

- [x] `quick-translation`：恢复主窗口释放保护逻辑
- [x] `context-translation`：实现基于 PromptAnchor 的窗口定位
- [x] `clipboard` 降级：保留锚点和 restoreTarget 元数据
- [x] Omnibox restore：复合 token + UI Automation 重新聚焦
- [ ] `context-translation` + Chromium 地址栏：进一步提升捕获稳定性，优先在地址栏编辑态拿到 Edit 控件的锚点与 restoreTarget
- [ ] fallback-only 透明化：当明确 `canRestoreTargetAfterPrompt=false` 或 `canAutoWriteBackAfterPrompt=false` 时，UI/日志应更清楚地提示”本次只支持 fallback，不承诺自动替换”

## Recording Rules

每跑完一个目标应用，都把结果同步填写到：

- [2026-03-08-windows-text-translation-compatibility-matrix.md](./2026-03-08-windows-text-translation-compatibility-matrix.md)

至少记录：

- 目标应用
- 成功/失败/兜底
- helperState
- errorCode
- 关键日志摘要

## Known Gap

- `context` 快捷键已接入独立 prompt 浮窗、IPC 与主流程编排，锚点定位已完成（commit `2edddbd`）
- Chromium 地址栏 / omnibox 在当前样本里仍只能走 `clipboard` 降级（commit `e7aaa80` 改善了元数据），尚未进入”prompt 后恢复原目标并自动写回”的承诺范围，但 restore token 和控制 refocus 已升级（commit `7a5b0fd`）
- `quick-translation` 和 `context-translation` 的主窗口焦点回归问题已修复（commit `b588805`）
