# Windows Text Translation Client Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现首个可工作的 Windows 系统级文本翻译客户端版本，具备托盘常驻、全局快捷键、统一翻译适配层、Windows 辅助进程边界，以及回写失败时的弹窗兜底能力。

**Architecture:** 纯业务规则放在 `src/core/`，跨层 DTO 与常量放在 `src/shared/`，主进程编排和 Electron 壳层放在 `src/electron/`，配置与状态 UI 放在 `src/renderer/`。Windows 系统交互通过 `src/electron/platform/win32/` 后面的辅助进程边界接入，避免平台细节泄漏到核心层和渲染层。

**Tech Stack:** TypeScript、Electron、React、Vite、Node.js、`contextBridge`、本地 JSON 配置文件，以及后续接入的 Windows 专用辅助进程。

---

### Task 1: 建立共享类型与默认配置

**Files:**
- Create: `src/core/contracts/index.ts`
- Create: `src/core/entities/translation.ts`
- Create: `src/core/entities/text-capture.ts`
- Create: `src/core/entities/write-back.ts`
- Create: `src/core/entities/execution-report.ts`
- Create: `src/shared/constants/ipc.ts`
- Create: `src/shared/constants/default-settings.ts`
- Create: `src/shared/types/settings.ts`
- Create: `src/shared/types/ipc.ts`
- Modify: `src/electron/preload.ts`

**Step 1: Write the failing test**

先写一个最小类型使用面，要求 `preload` 暴露的 API 能引用 `AppSettings`、`TranslationRequest`、`ExecutionReport` 等共享类型。

**Step 2: Run test to verify it fails**

Run: `npm run typecheck`  
Expected: FAIL，提示缺少共享类型或导出。

**Step 3: Write minimal implementation**

实现最小但稳定的 DTO：

- `TranslationRequest`
- `TranslationResult`
- `TextCaptureResult`
- `WriteBackResult`
- `ExecutionReport`
- `AppSettings`

同时增加 IPC 通道名和默认设置常量。

**Step 4: Run test to verify it passes**

Run: `npm run typecheck`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/core src/shared src/electron/preload.ts
git commit -m "feat: add shared domain contracts"
```

如果当前目录不是 Git 仓库，则跳过提交并记录原因。

---

### Task 2: 建立本地配置持久化与安全桥接 API

**Files:**
- Create: `src/electron/services/settings-service.ts`
- Create: `src/electron/ipc/register-settings-ipc.ts`
- Create: `src/electron/security/expose-settings-api.ts`
- Create: `src/shared/utils/settings-validation.ts`
- Modify: `src/electron/main.ts`
- Modify: `src/electron/preload.ts`
- Test: `src/electron/services/settings-service.test.ts`

**Step 1: Write the failing test**

先写测试，断言“配置文件不存在时返回默认配置；保存后再次读取能得到同一份设置”。

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/settings-service.test.ts`  
Expected: FAIL，因为服务和测试基建尚未完成。

**Step 3: Write minimal implementation**

实现：

- 本地 JSON 配置文件读写
- 默认值回退
- 基本配置校验
- `preload` 可调用的 `getSettings`、`saveSettings`、`getRuntimeStatus`

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/settings-service.test.ts`  
Expected: PASS。

Run: `npm run typecheck`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/services/settings-service.ts src/electron/ipc/register-settings-ipc.ts src/electron/security/expose-settings-api.ts src/shared/utils/settings-validation.ts src/electron/main.ts src/electron/preload.ts src/electron/services/settings-service.test.ts
git commit -m "feat: add local settings persistence"
```

---

### Task 3: 配置测试框架并覆盖核心用例

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `src/core/use-cases/quick-translate.use-case.test.ts`
- Create: `src/core/use-cases/context-translate.use-case.test.ts`

**Step 1: Write the failing test**

先写两个核心测试：

- 快速翻译会根据设置构造 `TranslationRequest`
- 上下文增强翻译会把用户补充指令带入请求

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/use-cases/quick-translate.use-case.test.ts`  
Expected: FAIL，因为测试框架或用例实现缺失。

**Step 3: Write minimal implementation**

新增：

- `vitest.config.ts`
- `package.json` 中的 `test` 脚本
- 适合 Node 环境的最小测试配置

**Step 4: Run test to verify it passes**

Run: `npm test`  
Expected: PASS，至少核心测试可执行。

**Step 5: Commit**

```bash
git add vitest.config.ts package.json src/core/use-cases/*.test.ts
git commit -m "test: set up vitest for core logic"
```

---

### Task 4: 实现快速翻译与增强翻译核心用例

**Files:**
- Create: `src/core/use-cases/execute-quick-translation.ts`
- Create: `src/core/use-cases/execute-context-translation.ts`
- Modify: `src/core/use-cases/quick-translate.use-case.test.ts`
- Modify: `src/core/use-cases/context-translate.use-case.test.ts`

**Step 1: Write the failing test**

补充断言：

- 快速翻译默认输出模式为 `replace-original`
- 增强翻译会保留 `instructions`
- 空文本输入时返回明确的业务错误

**Step 2: Run test to verify it fails**

Run: `npm test`  
Expected: FAIL，因为用例尚未实现完整逻辑。

**Step 3: Write minimal implementation**

实现两个纯函数用例，负责：

- 基于设置构造翻译请求
- 处理自动检测源语言
- 决定默认输出模式
- 为空输入返回结构化失败结果

**Step 4: Run test to verify it passes**

Run: `npm test`  
Expected: PASS。

Run: `npm run typecheck`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/core/use-cases/execute-quick-translation.ts src/core/use-cases/execute-context-translation.ts src/core/use-cases/*.test.ts
git commit -m "feat: add core translation use cases"
```

---

### Task 5: 建立统一翻译提供方边界

**Files:**
- Create: `src/electron/services/translation-provider-service.ts`
- Create: `src/electron/services/providers/provider-registry.ts`
- Create: `src/electron/services/providers/mock-provider.ts`
- Create: `src/electron/services/providers/http-provider.ts`
- Test: `src/electron/services/translation-provider-service.test.ts`

**Step 1: Write the failing test**

先写测试，断言“选中的 provider 会收到标准化请求，并返回标准化结果”。

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/translation-provider-service.test.ts`  
Expected: FAIL，因为 provider 服务尚未存在。

**Step 3: Write minimal implementation**

实现：

- provider 注册表
- 一个稳定的 `mock provider`
- 一个面向真实 HTTP 供应商的抽象边界
- 错误归一化逻辑

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/translation-provider-service.test.ts`  
Expected: PASS。

Run: `npm test`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/services/translation-provider-service.ts src/electron/services/providers src/electron/services/translation-provider-service.test.ts
git commit -m "feat: add unified provider boundary"
```

---

### Task 6: 加入托盘、窗口与全局快捷键基础设施

**Files:**
- Create: `src/electron/services/tray-service.ts`
- Create: `src/electron/services/shortcut-service.ts`
- Create: `src/electron/services/window-service.ts`
- Modify: `src/electron/main.ts`
- Test: `src/electron/services/shortcut-service.test.ts`

**Step 1: Write the failing test**

先写测试，断言“根据设置注册两个全局快捷键，并支持重新注册”。

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/shortcut-service.test.ts`  
Expected: FAIL。

**Step 3: Write minimal implementation**

实现：

- 托盘图标与托盘菜单
- 设置窗口打开/隐藏逻辑
- 快捷键注册和刷新逻辑
- 关闭主窗口后继续托盘驻留

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/shortcut-service.test.ts`  
Expected: PASS。

Run: `npm run typecheck`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/services/tray-service.ts src/electron/services/shortcut-service.ts src/electron/services/window-service.ts src/electron/main.ts src/electron/services/shortcut-service.test.ts
git commit -m "feat: add tray and global shortcut runtime"
```

---

### Task 7: 建立 Windows 平台适配器与辅助进程协议边界

**Files:**
- Create: `src/electron/platform/win32/adapter.ts`
- Create: `src/electron/platform/win32/protocol.ts`
- Create: `src/electron/platform/win32/process-client.ts`
- Create: `src/electron/services/system-interaction-service.ts`
- Test: `src/electron/platform/win32/adapter.test.ts`

**Step 1: Write the failing test**

先写测试，断言“辅助进程响应会被归一化为标准 `TextCaptureResult` 和 `WriteBackResult`”。

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/platform/win32/adapter.test.ts`  
Expected: FAIL。

**Step 3: Write minimal implementation**

实现：

- 辅助进程请求/响应协议
- 进程客户端封装
- `win32` 适配器
- 系统交互门面服务

此阶段辅助进程可以先使用 stub。

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/platform/win32/adapter.test.ts`  
Expected: PASS。

Run: `npm test`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/platform/win32 src/electron/services/system-interaction-service.ts src/electron/platform/win32/adapter.test.ts
git commit -m "feat: add win32 adapter boundary"
```

---

### Task 8: 实现捕获与回写 fallback 决策

**Files:**
- Create: `src/core/use-cases/decide-capture-fallback.ts`
- Create: `src/core/use-cases/decide-write-back-fallback.ts`
- Modify: `src/electron/services/system-interaction-service.ts`
- Test: `src/core/use-cases/decide-capture-fallback.test.ts`
- Test: `src/core/use-cases/decide-write-back-fallback.test.ts`

**Step 1: Write the failing test**

先写测试，断言：

- `UIA` 失败后会进入剪贴板 fallback
- 替换和粘贴都失败后进入 `popup-fallback`

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/use-cases/decide-capture-fallback.test.ts src/core/use-cases/decide-write-back-fallback.test.ts`  
Expected: FAIL。

**Step 3: Write minimal implementation**

实现纯决策逻辑，并把它接入系统交互服务中。

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/use-cases/decide-capture-fallback.test.ts src/core/use-cases/decide-write-back-fallback.test.ts`  
Expected: PASS。

Run: `npm test`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/core/use-cases/decide-capture-fallback.ts src/core/use-cases/decide-write-back-fallback.ts src/electron/services/system-interaction-service.ts src/core/use-cases/*.test.ts
git commit -m "feat: add capture and write-back fallback decisions"
```

---

### Task 9: 打通快速翻译端到端主流程

**Files:**
- Create: `src/electron/services/quick-translation-runner.ts`
- Modify: `src/electron/services/shortcut-service.ts`
- Modify: `src/electron/services/translation-provider-service.ts`
- Modify: `src/electron/services/system-interaction-service.ts`
- Test: `src/electron/services/quick-translation-runner.test.ts`

**Step 1: Write the failing test**

先写测试，断言“成功路径下会完成捕获、翻译、回写，并输出 `completed` 执行报告；失败路径会走弹窗兜底”。

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/quick-translation-runner.test.ts`  
Expected: FAIL。

**Step 3: Write minimal implementation**

实现：

- 设置读取
- 文本捕获
- 快速翻译请求构造
- provider 调用
- 回写尝试
- 失败时弹窗展示与复制剪贴板
- 执行报告记录

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/quick-translation-runner.test.ts`  
Expected: PASS。

Run: `npm test`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/services/quick-translation-runner.ts src/electron/services/shortcut-service.ts src/electron/services/translation-provider-service.ts src/electron/services/system-interaction-service.ts src/electron/services/quick-translation-runner.test.ts
git commit -m "feat: wire quick translation workflow"
```

---

### Task 10: 打通增强翻译弹窗与兜底结果窗口

**Files:**
- Create: `src/electron/services/popup-service.ts`
- Create: `src/electron/services/context-translation-runner.ts`
- Create: `src/renderer/pages/settings-page.tsx`
- Create: `src/renderer/pages/context-popup-page.tsx`
- Create: `src/renderer/pages/fallback-result-page.tsx`
- Modify: `src/renderer/app/App.tsx`
- Modify: `src/renderer/app/styles.css`
- Test: `src/electron/services/context-translation-runner.test.ts`
- Test: `src/renderer/features/popup-state.test.ts`

**Step 1: Write the failing test**

先写两个测试：

- 增强翻译 runner 会采集用户指令并在回写失败时保留结果
- fallback 弹窗会显示复制与重试插回操作

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/context-translation-runner.test.ts src/renderer/features/popup-state.test.ts`  
Expected: FAIL。

**Step 3: Write minimal implementation**

实现：

- 上下文增强输入弹窗
- 回写失败结果弹窗
- 增强翻译 runner
- 渲染层设置页和运行状态基础骨架

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/context-translation-runner.test.ts src/renderer/features/popup-state.test.ts`  
Expected: PASS。

Run: `npm run typecheck`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/services/popup-service.ts src/electron/services/context-translation-runner.ts src/renderer/pages src/renderer/app/App.tsx src/renderer/app/styles.css src/electron/services/context-translation-runner.test.ts src/renderer/features/popup-state.test.ts
git commit -m "feat: add context translation and fallback popup flows"
```

---

### Task 11: 增加运行状态、诊断信息和兼容性文档

**Files:**
- Create: `src/electron/services/execution-report-service.ts`
- Create: `src/renderer/features/runtime-status/runtime-status-panel.tsx`
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/renderer/app/App.tsx`
- Create: `docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md`
- Modify: `README.md`
- Test: `src/electron/services/execution-report-service.test.ts`

**Step 1: Write the failing test**

先写测试，断言“最近执行记录只保留有限条数，且不泄漏完整原文与译文”。

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/execution-report-service.test.ts`  
Expected: FAIL。

**Step 3: Write minimal implementation**

实现：

- 最近执行记录服务
- 渲染层运行状态面板
- 隐私安全的日志字段
- 兼容性手工验证矩阵文档
- README 中的 MVP 边界与验证说明

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/execution-report-service.test.ts`  
Expected: PASS。

Run: `npm run typecheck`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/services/execution-report-service.ts src/renderer/features/runtime-status/runtime-status-panel.tsx src/shared/types/ipc.ts src/renderer/app/App.tsx docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md README.md src/electron/services/execution-report-service.test.ts
git commit -m "feat: add runtime diagnostics and compatibility docs"
```

---

## Execution Notes

- 当前工作区不是 Git 仓库，因此 `worktree` 和 `git commit` 步骤在本环境中暂时无法执行。
- 首个真实 provider 接入前，应先保证 `mock provider` 路径稳定可测。
- 渲染层不得直接依赖平台实现。
- Windows 细节必须持续收敛在 `src/electron/platform/win32/` 后面。
