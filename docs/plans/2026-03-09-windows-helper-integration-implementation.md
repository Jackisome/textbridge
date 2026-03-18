# Windows Helper Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `feature/windows-text-translation-client` worktree 上接入基于 `C#/.NET` 的 Windows helper，打通真实 Windows 系统 API 的文本捕获、写回、剪贴板与诊断日志，并把全局快捷键真正连到 quick/context translation 工作流。

**Architecture:** 共享层只定义平台无关的运行状态和执行报告字段；Electron 主进程通过 `platform/common` 的 stdio JSON 客户端与 `platform/win32` 的 helper session 进行通信；Windows 具体 API 调用全部收敛在 `native/win32-helper` 中。运行状态面板展示用户级状态，开发级诊断日志落在主进程和 helper 双日志文件中，开发环境默认开启 `debug`。

**Tech Stack:** TypeScript, Electron, React, Vitest, C#/.NET, Windows UI Automation, SendInput, NDJSON over stdio

---

**Execution Base:** 本计划默认在本机现有的 `feature/windows-text-translation-client` worktree 上执行，而不是当前较早期的 `main`。如果从 `main` 开始，需先补齐该 worktree 中已有的 quick/context runner、execution report 和 runtime status 骨架。

### Task 1: 定义 helper 协议与运行状态类型

**Files:**
- Create: `src/electron/platform/common/helper-protocol.ts`
- Test: `src/electron/platform/common/helper-protocol.test.ts`
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/electron/services/execution-report-service.ts`
- Modify: `src/electron/services/execution-report-service.test.ts`

**Step 1: 写失败测试，固定协议和运行状态形状**

```ts
import { describe, expect, it } from 'vitest';
import { isHelperResponse, toHelperRequest } from './helper-protocol';

describe('helper protocol', () => {
  it('creates a request with id, kind, timestamp and payload', () => {
    const request = toHelperRequest('health-check', {});
    expect(request.kind).toBe('health-check');
    expect(request.id).toMatch(/^req-/);
  });

  it('accepts only valid helper responses', () => {
    expect(isHelperResponse({ id: 'req-1', kind: 'health-check', ok: true, payload: {} })).toBe(true);
    expect(isHelperResponse({ kind: 'health-check' })).toBe(false);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/electron/platform/common/helper-protocol.test.ts src/electron/services/execution-report-service.test.ts`  
Expected: FAIL，提示 `helper-protocol.ts` 不存在，或运行状态缺少 helper 字段。

**Step 3: 写最小实现**

在 `helper-protocol.ts` 中定义：

- 请求类型：`health-check`、`capture-text`、`write-text`、`clipboard-write`
- 响应类型：统一带 `id`、`kind`、`ok`、`payload`、`error`、`diagnostics`
- 工具函数：`toHelperRequest()`、`isHelperResponse()`

在 `src/shared/types/ipc.ts` 中扩展 `RuntimeStatus`：

- `helperState: 'idle' | 'starting' | 'ready' | 'degraded' | 'stopped'`
- `helperLastErrorCode: string | null`
- `helperPid: number | null`

在 `execution-report-service.ts` 中允许把 helper 状态快照带入 `getRuntimeStatus()`。

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/electron/platform/common/helper-protocol.test.ts src/electron/services/execution-report-service.test.ts`  
Expected: PASS。

**Step 5: 提交**

```bash
git add src/electron/platform/common/helper-protocol.ts src/electron/platform/common/helper-protocol.test.ts src/shared/types/ipc.ts src/electron/services/execution-report-service.ts src/electron/services/execution-report-service.test.ts
git commit -m "feat(platform): define helper protocol and runtime status"
```

### Task 2: 建立主进程诊断日志服务与 helper 启动路径解析

**Files:**
- Create: `src/electron/services/diagnostic-log-service.ts`
- Test: `src/electron/services/diagnostic-log-service.test.ts`
- Create: `src/electron/platform/win32/helper-path.ts`
- Test: `src/electron/platform/win32/helper-path.test.ts`
- Modify: `package.json`

**Step 1: 写失败测试，固定日志级别和 helper 路径规则**

```ts
describe('diagnostic log service', () => {
  it('defaults to debug when app is not packaged', () => {
    const service = createDiagnosticLogService({ isPackaged: false });
    expect(service.getLevel()).toBe('debug');
  });
});

describe('helper path', () => {
  it('uses dotnet run in development', () => {
    const command = resolveWin32HelperLaunch({ isPackaged: false });
    expect(command.command).toBe('dotnet');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/electron/services/diagnostic-log-service.test.ts src/electron/platform/win32/helper-path.test.ts`  
Expected: FAIL，提示日志服务和 helper path 解析器不存在。

**Step 3: 写最小实现**

实现内容：

- `diagnostic-log-service.ts`
  - 支持 `debug/info/warn/error`
  - `app.isPackaged === false` 默认 `debug`
  - 环境变量 `TEXTBRIDGE_LOG_LEVEL` 可覆盖
  - 写控制台和日志文件
- `helper-path.ts`
  - 开发环境返回：
    - `command: 'dotnet'`
    - `args: ['run', '--project', 'native/win32-helper/TextBridge.Win32Helper.csproj']`
  - 生产环境返回 helper 可执行文件路径
- `package.json`
  - 增加 `helper:build`
  - 增加 `helper:test`
  - 增加 `helper:publish`

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/electron/services/diagnostic-log-service.test.ts src/electron/platform/win32/helper-path.test.ts`  
Expected: PASS。

**Step 5: 提交**

```bash
git add src/electron/services/diagnostic-log-service.ts src/electron/services/diagnostic-log-service.test.ts src/electron/platform/win32/helper-path.ts src/electron/platform/win32/helper-path.test.ts package.json
git commit -m "feat(logging): add diagnostic logging and helper path resolution"
```

### Task 3: 实现 stdio JSON 客户端与 win32 helper session

**Files:**
- Create: `src/electron/platform/common/stdio-json-client.ts`
- Test: `src/electron/platform/common/stdio-json-client.test.ts`
- Create: `src/electron/platform/win32/helper-session-service.ts`
- Test: `src/electron/platform/win32/helper-session-service.test.ts`

**Step 1: 写失败测试，固定请求匹配、超时和重启行为**

```ts
it('matches helper responses by id and resolves the pending request', async () => {
  const client = createStdIoJsonClient(fakeTransport);
  const promise = client.send({ id: 'req-1', kind: 'health-check', timestamp: '...', payload: {} });
  fakeTransport.pushStdout('{"id":"req-1","kind":"health-check","ok":true,"payload":{}}\n');
  await expect(promise).resolves.toMatchObject({ ok: true });
});

it('marks the helper session as degraded after request timeout', async () => {
  const session = createWin32HelperSessionService(fakeSpawn);
  await expect(session.send('health-check', {})).rejects.toThrow('PLATFORM_BRIDGE_TIMEOUT');
  expect(session.getSnapshot().helperState).toBe('degraded');
});
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/electron/platform/common/stdio-json-client.test.ts src/electron/platform/win32/helper-session-service.test.ts`  
Expected: FAIL，提示 stdio 客户端和 session 服务不存在。

**Step 3: 写最小实现**

实现内容：

- `stdio-json-client.ts`
  - 管理 `stdout` buffer
  - 逐行解析 NDJSON
  - 按 `id` 关联 pending 请求
  - 监听 `stderr` 并转发给诊断日志服务
- `helper-session-service.ts`
  - 惰性启动 helper
  - 启动后先执行 `health-check`
  - 提供 `send(kind, payload)`、`getSnapshot()`、`dispose()`
  - 请求超时后标记 `degraded`
  - 子进程退出后清空 pending 请求并保留最后错误码

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/electron/platform/common/stdio-json-client.test.ts src/electron/platform/win32/helper-session-service.test.ts`  
Expected: PASS。

**Step 5: 提交**

```bash
git add src/electron/platform/common/stdio-json-client.ts src/electron/platform/common/stdio-json-client.test.ts src/electron/platform/win32/helper-session-service.ts src/electron/platform/win32/helper-session-service.test.ts
git commit -m "feat(platform): add stdio helper session runtime"
```

### Task 4: 搭建 .NET helper 宿主与 health-check

**Files:**
- Create: `native/win32-helper/TextBridge.Win32Helper.csproj`
- Create: `native/win32-helper/Program.cs`
- Create: `native/win32-helper/Protocols/HelperRequest.cs`
- Create: `native/win32-helper/Protocols/HelperResponse.cs`
- Create: `native/win32-helper/Services/StdIoHost.cs`
- Create: `native/win32-helper/Services/Logger.cs`
- Create: `native/win32-helper/Services/HealthCheckService.cs`
- Create: `native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`
- Create: `native/win32-helper/TextBridge.Win32Helper.Tests/HealthCheckServiceTests.cs`

**Step 1: 写失败测试，固定 helper 最小健康检查响应**

```csharp
public class HealthCheckServiceTests
{
    [Fact]
    public void Returns_version_and_capabilities()
    {
        var service = new HealthCheckService();
        var response = service.GetStatus();

        Assert.Equal("ok", response.Status);
        Assert.Contains("capture-text", response.Capabilities);
    }
}
```

**Step 2: 运行测试确认失败**

Run: `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`  
Expected: FAIL，提示 helper 工程和健康检查服务不存在。

**Step 3: 写最小实现**

实现内容：

- helper 宿主从 `stdin` 按行读取 JSON 请求
- 将 `health-check` 路由到 `HealthCheckService`
- 仅用 `stdout` 输出结构化响应
- `Logger` 统一向 `stderr` 和 helper 日志文件写入诊断日志
- 测试工程使用 `xUnit`

**Step 4: 运行测试确认通过**

Run: `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`  
Expected: PASS。

**Step 5: 提交**

```bash
git add native/win32-helper
git commit -m "feat(win32-helper): scaffold helper host and health check"
```

### Task 5: 实现文本捕获链路并接入 TypeScript adapter

**Files:**
- Create: `native/win32-helper/Interop/AutomationFacade.cs`
- Create: `native/win32-helper/Interop/InputSimulationService.cs`
- Create: `native/win32-helper/Interop/ClipboardTextService.cs`
- Create: `native/win32-helper/Services/CaptureTextService.cs`
- Create: `native/win32-helper/TextBridge.Win32Helper.Tests/CaptureTextServiceTests.cs`
- Modify: `native/win32-helper/Program.cs`
- Modify: `src/electron/platform/win32/adapter.ts`
- Modify: `src/electron/platform/win32/adapter.test.ts`
- Modify: `src/electron/services/system-interaction-service.ts`
- Create: `src/electron/services/system-interaction-service.test.ts`

**Step 1: 写失败测试，固定 UIA 优先与 clipboard-copy fallback 的行为**

```csharp
[Fact]
public async Task Returns_selected_text_from_uia_when_selection_exists()
{
    var service = new CaptureTextService(fakeAutomation, fakeClipboard, fakeInput);
    var result = await service.CaptureAsync("uia");
    Assert.True(result.Ok);
    Assert.Equal("hello", result.Text);
}

[Fact]
public async Task Falls_back_to_clipboard_copy_when_uia_is_unavailable()
{
    var result = await service.CaptureAsync("clipboard-copy");
    Assert.True(result.Ok);
    Assert.Equal("copied text", result.Text);
}
```

在 TS 侧补测试：

```ts
it('retries capture through clipboard-copy when the first attempt is unsupported', async () => {
  const adapter = { captureText: vi.fn()
    .mockResolvedValueOnce({ success: false, method: 'uia', errorCode: 'TEXT_CAPTURE_UNSUPPORTED' })
    .mockResolvedValueOnce({ success: true, method: 'clipboard-copy', text: 'copied text' }) };
  const service = createSystemInteractionService({ adapter });
  await expect(service.captureSelectedText(settings)).resolves.toMatchObject({ success: true, text: 'copied text' });
});
```

**Step 2: 运行测试确认失败**

Run: `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`  
Run: `npx vitest run src/electron/platform/win32/adapter.test.ts src/electron/services/system-interaction-service.test.ts`  
Expected: FAIL，提示 `capture-text` 未实现，或 TS adapter 仍然只返回 stub。

**Step 3: 写最小实现**

实现内容：

- helper 的 `CaptureTextService`
  - `uia` 路径优先尝试 `TextPattern`
  - 无 `TextPattern` 时尝试 `ValuePattern`
  - 无明确选区时返回 `TEXT_CAPTURE_NO_SELECTION`
  - `clipboard-copy` 路径发送模拟复制并读取剪贴板文本
  - 返回上层统一错误码 + Windows diagnostics
- TS 侧 `adapter.ts`
  - 依赖 `helper-session-service`
  - 将 helper 响应映射为 `TextCaptureResult`
- `system-interaction-service.ts`
  - 保持 `uia` 首选 + `clipboard-copy` fallback 决策

**Step 4: 运行测试确认通过**

Run: `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`  
Run: `npx vitest run src/electron/platform/win32/adapter.test.ts src/electron/services/system-interaction-service.test.ts`  
Expected: PASS。

**Step 5: 提交**

```bash
git add native/win32-helper/Interop native/win32-helper/Services/CaptureTextService.cs native/win32-helper/TextBridge.Win32Helper.Tests/CaptureTextServiceTests.cs src/electron/platform/win32/adapter.ts src/electron/platform/win32/adapter.test.ts src/electron/services/system-interaction-service.ts src/electron/services/system-interaction-service.test.ts
git commit -m "feat(win32-helper): implement text capture pipeline"
```

### Task 6: 实现写回与 clipboard-write 链路

**Files:**
- Create: `native/win32-helper/Services/WriteTextService.cs`
- Create: `native/win32-helper/TextBridge.Win32Helper.Tests/WriteTextServiceTests.cs`
- Modify: `native/win32-helper/Program.cs`
- Modify: `src/electron/platform/win32/adapter.ts`
- Modify: `src/electron/platform/win32/adapter.test.ts`
- Modify: `src/electron/services/system-interaction-service.ts`
- Modify: `src/electron/services/system-interaction-service.test.ts`

**Step 1: 写失败测试，固定 replace-selection、paste-translation 和 clipboard-write 行为**

```csharp
[Fact]
public async Task Rejects_replace_when_selection_cannot_be_verified()
{
    var result = await service.WriteAsync("translated", "replace-selection");
    Assert.False(result.Ok);
    Assert.Equal("WRITE_BACK_UNSUPPORTED", result.Error.Code);
}

[Fact]
public async Task Uses_clipboard_and_sendinput_for_paste_translation()
{
    var result = await service.WriteAsync("translated", "paste-translation");
    Assert.True(result.Ok);
}
```

TS 侧补测试：

```ts
it('returns popup-fallback after replace and paste both fail', async () => {
  const adapter = { writeText: vi.fn()
    .mockResolvedValueOnce({ success: false, method: 'replace-selection', errorCode: 'WRITE_BACK_REPLACE_FAILED' })
    .mockResolvedValueOnce({ success: false, method: 'paste-translation', errorCode: 'WRITE_BACK_PASTE_FAILED' }) };
  const service = createSystemInteractionService({ adapter });
  await expect(service.writeTranslatedText('你好', settings)).resolves.toMatchObject({ method: 'popup-fallback' });
});
```

**Step 2: 运行测试确认失败**

Run: `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`  
Run: `npx vitest run src/electron/platform/win32/adapter.test.ts src/electron/services/system-interaction-service.test.ts`  
Expected: FAIL，提示 `write-text` / `clipboard-write` 尚未实现。

**Step 3: 写最小实现**

实现内容：

- helper 的 `WriteTextService`
  - `replace-selection` 仅在可安全确认选区时替换
  - `paste-translation` 先写剪贴板，再发模拟粘贴
  - `clipboard-write` 单独路由，用于 popup fallback
- TS 侧 `adapter.ts`
  - 映射 `write-text` 和 `clipboard-write` 响应
- `system-interaction-service.ts`
  - 保持 `replace-selection` -> `paste-translation` -> `popup-fallback` 的 fallback 链

**Step 4: 运行测试确认通过**

Run: `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`  
Run: `npx vitest run src/electron/platform/win32/adapter.test.ts src/electron/services/system-interaction-service.test.ts`  
Expected: PASS。

**Step 5: 提交**

```bash
git add native/win32-helper/Services/WriteTextService.cs native/win32-helper/TextBridge.Win32Helper.Tests/WriteTextServiceTests.cs native/win32-helper/Program.cs src/electron/platform/win32/adapter.ts src/electron/platform/win32/adapter.test.ts src/electron/services/system-interaction-service.ts src/electron/services/system-interaction-service.test.ts
git commit -m "feat(win32-helper): implement write-back and clipboard commands"
```

### Task 7: 把快捷键真正接到 quick/context runner，并补全运行状态面板

**Files:**
- Modify: `src/electron/main.ts`
- Modify: `src/electron/services/quick-translation-runner.ts`
- Modify: `src/electron/services/quick-translation-runner.test.ts`
- Modify: `src/electron/services/context-translation-runner.ts`
- Modify: `src/electron/services/context-translation-runner.test.ts`
- Modify: `src/electron/ipc/register-settings-ipc.ts`
- Modify: `src/electron/preload.ts`
- Modify: `src/renderer/app/App.tsx`
- Modify: `src/renderer/pages/settings-page.tsx`
- Modify: `src/renderer/features/runtime-status/runtime-status-panel.tsx`
- Create: `src/renderer/features/runtime-status/runtime-status-panel.test.tsx`

**Step 1: 写失败测试，固定热键触发与运行状态刷新**

```ts
it('runs quick translation instead of only showing the main window', async () => {
  const run = vi.fn().mockResolvedValue(report);
  const shortcutService = createShortcutService({ registrar, handlers: { onQuickTranslate: run, onContextTranslate: vi.fn() } });
  shortcutService.applySettings(settings);
  await registrar.callbacks[0]();
  expect(run).toHaveBeenCalled();
});

it('shows helper state and last helper error in runtime status panel', () => {
  render(<RuntimeStatusPanel runtimeStatus={{ ...status, helperState: 'degraded', helperLastErrorCode: 'PLATFORM_BRIDGE_TIMEOUT' }} />);
  expect(screen.getByText('degraded')).toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/electron/services/quick-translation-runner.test.ts src/electron/services/context-translation-runner.test.ts src/renderer/features/runtime-status/runtime-status-panel.test.tsx`  
Expected: FAIL，提示 `main.ts` 仍然只调用 `showMainWindow()`，运行状态面板缺少 helper 字段或刷新逻辑。

**Step 3: 写最小实现**

实现内容：

- `main.ts`
  - 创建 `helper-session-service`
  - 创建 `system-interaction-service`
  - 创建 `translation-provider-service`
  - 创建 `quick/context runner`
  - 热键直接调用 runner，而不是只展示设置窗口
- `quick/context runner`
  - 记录 helper 状态快照和最后错误码
- `register-settings-ipc.ts` / `preload.ts`
  - 保持运行状态读取接口稳定
- `App.tsx`
  - 加入运行状态刷新方法
  - 开发环境下定时刷新 `getRuntimeStatus()`
  - 保存设置后也刷新
- `runtime-status-panel.tsx`
  - 增加 `helperState`
  - 增加 `helperLastErrorCode`
  - 保留最近执行记录

**Step 4: 运行测试确认通过**

Run: `npx vitest run src/electron/services/quick-translation-runner.test.ts src/electron/services/context-translation-runner.test.ts src/renderer/features/runtime-status/runtime-status-panel.test.tsx`  
Expected: PASS。

**Step 5: 提交**

```bash
git add src/electron/main.ts src/electron/services/quick-translation-runner.ts src/electron/services/quick-translation-runner.test.ts src/electron/services/context-translation-runner.ts src/electron/services/context-translation-runner.test.ts src/electron/ipc/register-settings-ipc.ts src/electron/preload.ts src/renderer/app/App.tsx src/renderer/pages/settings-page.tsx src/renderer/features/runtime-status/runtime-status-panel.tsx src/renderer/features/runtime-status/runtime-status-panel.test.tsx
git commit -m "feat(runtime): wire helper-backed translation hotkeys"
```

### Task 8: 补齐人工验证文档、兼容矩阵和最终验证命令

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md`
- Create: `docs/plans/2026-03-09-windows-helper-manual-validation.md`

**Step 1: 写失败检查，明确文档必须覆盖的验证项**

在文档中至少写清楚：

- 如何启动 Electron 与 helper
- 如何确认开发环境默认 `debug` 已开启
- 如何查看：
  - 设置页运行状态面板
  - `userData/logs/main.log`
  - `userData/logs/win32-helper.log`
- 如何验证：
  - 记事本标准输入框
  - 失败样本
  - 权限不匹配窗口

**Step 2: 运行现有全量验证，记录当前状态**

Run: `npm test`  
Run: `npm run typecheck`  
Run: `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`  
Expected: 在补文档前，代码验证可 PASS，但 README 与兼容矩阵仍缺 helper 说明。

**Step 3: 写最小实现**

文档需要包括：

- helper 构建与运行说明
- 调试日志说明
- 首版承诺的标准可编辑控件列表
- 首版不承诺范围
- 逐步手工验证流程
- 如何记录失败样本和对应错误码

**Step 4: 运行最终验证**

Run: `npm test`  
Run: `npm run typecheck`  
Run: `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`  
Run: `npm run build`  
Expected: 全部 PASS；若 `npm run build` 还未纳入 helper 打包，则至少明确记录缺口并补计划。

**Step 5: 提交**

```bash
git add README.md docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md docs/plans/2026-03-09-windows-helper-manual-validation.md
git commit -m "docs: add windows helper validation guidance"
```

## Notes

- 每个请求和每次热键执行都要贯穿同一组 `executionId` / `requestId`，否则调试日志无法串联。
- helper 的 `stdout` 绝不能混入普通日志；所有日志必须走 `stderr` 或 helper 日志文件。
- `replace-selection` 无法安全确认选区时，必须失败，不能整框覆盖。
- 对管理员权限窗口或更高完整性级别窗口，必须返回结构化错误而不是静默失败。
- 手工验证通过“标准可编辑控件”后，再按兼容矩阵推进 1 -> 2 -> 3 的扩展。
