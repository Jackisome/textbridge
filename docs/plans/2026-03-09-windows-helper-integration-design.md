# Windows Helper Integration Design

**Date:** 2026-03-09  
**Status:** Approved

## Goal

在不破坏现有分层规则的前提下，为 TextBridge 引入一个基于 `C#/.NET` 的 Windows helper，通过真实 Windows 系统 API 完成首版“标准可编辑控件”的文本捕获、文本写回、剪贴板协作与诊断日志能力，并为后续扩展到 `macOS`、`Linux`、`Chromium/Electron` 输入框及更复杂控件保留稳定抽象。

## Approved Decisions

- 首版平台实现仅落地 `Windows`
- Windows 平台能力通过独立 helper 进程承载，不直接把系统 API 调用塞进 Electron/Node 进程
- helper 技术栈采用 `C#/.NET`
- 主进程与 helper 之间使用 `JSON over stdio`
- helper 采用“首次触发启动，之后常驻并自动重连”的运行形态
- helper 首版协议只包含：
  - `health-check`
  - `capture-text`
  - `write-text`
  - `clipboard-write`
- 首版兼容目标为“标准可编辑控件”，验证通过后再扩展到：
  - Chromium/Electron/聊天输入框
  - Office/WPS/IDE 等复杂目标
- 首版只保证与 TextBridge 同权限级别的目标窗口；对管理员权限或更高完整性级别窗口只返回结构化错误
- 当捕获或写回降级到模拟复制/粘贴时，首版先不恢复原剪贴板内容
- 开发环境默认开启 `debug` 级诊断日志

## Architecture

### 1. Cross-Platform Boundaries

跨平台抽象严格分成四层：

- `src/core/`
  - 只保留平台无关的用例、实体、错误模型和 fallback 决策
  - 不出现 `UIA`、`SendInput`、`AXUIElement`、`X11` 之类的平台词汇
- `src/electron/services/`
  - 负责业务编排，不直接依赖 Windows API
  - 统一通过平台门面访问系统能力
- `src/electron/platform/`
  - 平台差异唯一合法落点
  - `common` 放 helper 通信抽象
  - `win32` 放 Windows 请求映射、错误映射、生命周期治理
- `native/win32-helper/`
  - `C#/.NET` helper 独立工程
  - 负责实际调用 Windows 系统 API

### 2. Stable Service Surface

主进程对上暴露的平台能力维持稳定方法：

- `captureSelectedText(settings)`
- `writeTranslatedText(text, settings)`
- `copyToClipboard(text)`
- `healthCheck()`
- `getPlatformDiagnostics()`

`quick/context runner` 只依赖这些稳定方法，不依赖 helper 细节。

### 3. Helper Project Layout

建议 helper 子项目目录如下：

- `native/win32-helper/TextBridge.Win32Helper.csproj`
- `native/win32-helper/Program.cs`
- `native/win32-helper/Protocols/`
- `native/win32-helper/Services/`
- `native/win32-helper/Interop/`
- `native/win32-helper/TextBridge.Win32Helper.Tests/`

## Protocol Design

### 1. Message Shape

请求采用 NDJSON，一行一条：

```json
{"id":"req-1","kind":"health-check","timestamp":"2026-03-09T10:00:00.000Z","payload":{}}
```

响应同样是一行一条：

```json
{"id":"req-1","kind":"health-check","ok":true,"payload":{"version":"0.1.0","capabilities":["capture-text","write-text","clipboard-write"]}}
```

所有请求必须带：

- `id`
- `kind`
- `timestamp`
- `payload`

所有响应必须带：

- `id`
- `kind`
- `ok`
- `payload`
- `error`
- `diagnostics`

### 2. Protocol Commands

首版仅支持以下命令：

- `health-check`
  - 返回 helper 版本、平台、能力位、进程状态
- `capture-text`
  - `payload.method` 首版允许：
    - `uia`
    - `clipboard-copy`
- `write-text`
  - `payload.method` 首版允许：
    - `replace-selection`
    - `paste-translation`
- `clipboard-write`
  - 将指定文本写入系统剪贴板

### 3. Protocol Constraints

- helper 的 `stdout` 只允许输出结构化协议响应
- helper 的 `stderr` 只允许输出诊断日志
- 主进程对每个请求维护 pending map，并按 `id` 关联响应
- 若超时未收到响应，则主进程返回结构化失败并将 helper 标记为 `degraded`

## Helper Lifecycle

主进程新增专门的 helper session 服务，职责为：

- 首次系统交互请求到来时启动 helper
- 启动后立即执行 `health-check`
- 维持单个常驻 helper 进程
- 负责请求发送、响应匹配、超时管理和 stderr 日志转存
- helper 退出、卡死或握手失败时清理状态
- 下一个请求到来时自动重启 helper
- `app.will-quit` 时执行 `dispose()`

helper 状态固定为：

- `idle`
- `starting`
- `ready`
- `degraded`
- `stopped`

首版超时建议：

- `health-check`: 3 秒
- `capture-text`: 5 秒
- `write-text`: 5 秒
- `clipboard-write`: 2 秒

首版不做自动重试；请求超时只记录错误并在下一次请求时尝试重新建连。

## Windows API Strategy

### 1. Capture Strategy

`capture-text(method='uia')` 的执行顺序：

1. 获取前台窗口和焦点元素
2. 优先尝试 `TextPattern`
3. 检测并读取当前选区文本
4. 若无 `TextPattern`，尝试 `ValuePattern`
5. 若无明确选区则返回 `TEXT_CAPTURE_NO_SELECTION`
6. 失败时交给上层决定是否走 `clipboard-copy`

`capture-text(method='clipboard-copy')` 的执行顺序：

1. 记录当前焦点窗口和元素摘要
2. 发送模拟复制
3. 等待剪贴板文本可读
4. 读取文本并返回
5. 失败时返回结构化错误

### 2. Write-Back Strategy

`write-text(method='replace-selection')` 的执行顺序：

1. 重新确认焦点元素与可编辑状态
2. 优先通过 UI Automation 可编辑接口替换当前选区
3. 若只能整体设值但无法安全确认选区，则直接失败
4. 成功时返回 `success: true`

`write-text(method='paste-translation')` 的执行顺序：

1. 将译文写入系统剪贴板
2. 确认焦点未明显漂移
3. 发送模拟粘贴
4. 返回成功或失败

首版明确禁止在无法安全确认选区时覆盖整个输入框内容。

### 3. First-Stage Compatibility Boundary

首版承诺覆盖：

- Windows 记事本
- 常见标准单行/多行输入框
- 常见 Win32 / WPF 文本编辑控件
- 常见系统设置类可编辑文本区域

首版观察但不承诺：

- Chromium 浏览器网页输入框
- Electron 应用输入框
- 聊天软件输入框

首版不承诺：

- Office / WPS 富文本编辑区
- IDE 代码编辑器
- 管理员权限窗口
- 自绘控件 / Canvas / 游戏界面

## Error Model

上层统一错误码建议固定为：

- `PLATFORM_BRIDGE_UNAVAILABLE`
- `PLATFORM_BRIDGE_TIMEOUT`
- `TEXT_CAPTURE_NO_FOCUS`
- `TEXT_CAPTURE_NO_SELECTION`
- `TEXT_CAPTURE_UNSUPPORTED`
- `TEXT_CAPTURE_CLIPBOARD_FAILED`
- `WRITE_BACK_TARGET_LOST`
- `WRITE_BACK_UNSUPPORTED`
- `WRITE_BACK_PASTE_FAILED`
- `WRITE_BACK_REPLACE_FAILED`

Windows 内部细码只记录在 helper diagnostics 和调试日志中，例如：

- `UIA_ELEMENT_NOT_FOUND`
- `UIA_TEXTPATTERN_UNAVAILABLE`
- `UIA_VALUEPATTERN_READONLY`
- `SENDINPUT_COPY_REJECTED`
- `SENDINPUT_PASTE_REJECTED`
- `FOCUS_CHANGED_DURING_WRITE`

## Logging And Observability

### 1. User-Facing Execution Reports

保留并扩展运行状态面板中的执行报告字段：

- `workflow`
- `status`
- `provider`
- `captureMethod`
- `writeBackMethod`
- `helperStatus`
- `errorCode`
- `errorMessage`
- `sourceTextLength`
- `translatedTextLength`
- 原文/译文短摘要
- `startedAt`
- `completedAt`

默认不显示完整原文和译文。

### 2. Developer Diagnostics

开发级日志分为主进程和 helper 两部分：

- `src/electron/services/diagnostic-log-service.ts`
- `native/win32-helper/Services/Logger.cs`

日志级别：

- `error`
- `warn`
- `info`
- `debug`

默认级别规则：

- `app.isPackaged === false` 时默认 `debug`
- 或显式环境变量 `TEXTBRIDGE_LOG_LEVEL=debug`
- 生产包默认 `info`

日志落点：

- Electron 主进程控制台
- `userData/logs/main.log`
- `userData/logs/win32-helper.log`

主进程和 helper 的日志都必须带：

- `executionId`
- `requestId`
- `timestamp`
- `level`
- `event`

### 3. Mandatory Debug Events

首版必须可记录：

- helper 启动、退出、重启原因
- `health-check` 请求与结果
- 前台窗口和焦点控件摘要
- UIA 尝试了哪些 pattern
- 是否检测到选区
- 模拟复制/粘贴是否已发出
- 剪贴板读取/写入是否成功
- 写回前后焦点是否漂移
- fallback 是在哪一步触发
- 最终错误码、耗时和 helper 状态

## End-To-End Flows

### Quick Translation

1. 全局快捷键触发
2. 主进程调用 `quick-translation-runner`
3. runner 读取设置
4. `system-interaction-service` 确保 helper 可用
5. helper 先尝试 `capture-text(method='uia')`
6. 必要时回退到 `capture-text(method='clipboard-copy')`
7. 捕获成功后走 provider 翻译
8. 再尝试 `write-text(method='replace-selection')`
9. 必要时回退到 `write-text(method='paste-translation')`
10. 最终失败则进入 popup fallback 并复制译文
11. 记录执行报告与诊断日志

### Context Translation

与 quick translation 结构一致，只在中间新增“弹窗补充上下文”步骤；helper 仍然只负责系统交互，不承担上下文输入逻辑。

## Delivery Stages

### Stage A: Protocol And Session Infrastructure

- helper 进程可被主进程惰性拉起
- `health-check` 可通
- 请求/响应、超时、重启和 stderr 转存可验证

### Stage B: Capture MVP

- 打通 `capture-text`
- 实现 `uia` 首选 + `clipboard-copy` fallback
- 在标准可编辑控件中稳定抓取选中文本

### Stage C: Write-Back MVP

- 打通 `write-text`
- 实现 `replace-selection` 首选 + `paste-translation` fallback
- 明确拒绝不安全整框覆盖

### Stage D: Runtime Wiring

- 快捷键真实接入 `quick/context runner`
- 执行报告、运行状态和诊断日志全链路贯通

### Stage E: Manual Validation

- 完成标准可编辑控件人工验证
- 记录兼容矩阵、失败样本和日志证据

## Expansion Strategy

### 1 -> 2

在“标准可编辑控件”验证稳定后，优先扩展到：

- Chromium 浏览器输入框
- Electron/Chromium 应用输入框
- 聊天软件输入框

主要增强点放在：

- helper 诊断字段
- 焦点识别
- 模拟复制/粘贴节奏控制
- 兼容矩阵分类

### 2 -> 3

再扩展到：

- Office
- WPS
- IDE 编辑器

这一阶段不默认承诺复用首版策略即可成功，而是通过兼容采样、日志归因和必要的特例适配逐步推进。

## Completion Criteria

本次“Windows 系统 API 接口与具体调用”完成的判定标准为：

1. `C#/.NET helper` 已接入并可被 Electron 主进程稳定调用
2. 开发环境默认开启 `debug` 级日志
3. 全局快捷键已真实接入 `quick translation runner`
4. helper 支持 `health-check`、`capture-text`、`write-text`、`clipboard-write`
5. 支持 `uia` 捕获与 `clipboard-copy` fallback
6. 支持 `replace-selection` 写回与 `paste-translation` fallback
7. 运行状态面板可显示 helper 状态、最近执行记录和最近错误
8. 在首版承诺的标准可编辑控件中完成人工验证
9. 兼容矩阵和失败样本已被记录，可直接用于下一阶段扩展
