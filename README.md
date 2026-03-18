# TextBridge

`TextBridge` 是一个面向多端扩展的文本翻译客户端项目，当前首版以 Windows 系统级文本翻译为第一阶段落地方向，目标是在标准文本控件中完成“获取文本 -> 翻译 -> 回写/兜底展示”的闭环。当前仓库基于 `Electron + Vite + React + TypeScript` 搭建，并已经整理为适合长期扩展的桌面应用分层结构。

## 当前开发组件

### 运行与桌面层

- `Electron`：桌面应用容器、窗口生命周期与原生能力入口
- `Preload + ContextBridge`：在开启 `contextIsolation` 的前提下安全暴露能力

### 前端层

- `React`：渲染进程 UI 组件开发
- `React DOM`：挂载 React 应用到 Electron 页面
- `Vite`：渲染层开发服务器、HMR 与前端构建
- `TypeScript`：主进程、预加载和渲染层统一类型系统
- `Vitest`：单元测试

### 翻译 Provider

支持多 Provider 接入，统一接口定义于 `src/shared/types/provider.ts`：

- `MiniMax`（原生实现，含完整错误处理）
- `Claude`（Anthropic）
- `Gemini`（Google）
- `DeepSeek`
- `Tongyi`（阿里云）
- `Tencent`（腾讯云）
- `Google`（Google Cloud Translation）
- `OpenAI-Compatible`（兼容 OpenAI 接口的第三方模型）
- `Custom`（用户自定义 endpoint）

Provider 配置统一由 `src/electron/services/providers/` 管理，`src/shared/constants/provider-metadata.ts` 定义各 Provider 的元数据。

### 开发辅助工具

- `concurrently`：并行启动 Vite、Electron TypeScript watch 与 Electron 进程
- `nodemon`：监听 `dist-electron/` 变化并自动重启 Electron
- `wait-on`：等待 Vite 服务与 Electron 编译输出准备完成
- `cross-env`：为 Electron 开发进程注入跨平台环境变量

## 环境依赖

- `Node.js + npm`：用于渲染层、主进程和测试命令
- `.NET SDK 10.x`：用于 `native/win32-helper` 的构建、运行与测试

建议先确认以下命令可用：

```powershell
dotnet --info
npm --version
```

如果开发环境下 `dotnet` 不在 `PATH`，可以通过环境变量指定实际路径：

```powershell
$env:TEXTBRIDGE_DOTNET_PATH="C:\Program Files\dotnet\dotnet.exe"
```

## 启动方式

### 开发模式

```powershell
npm run dev
```

开发模式会做这几件事：

- 启动 `Vite` 开发服务器，地址固定为 `http://127.0.0.1:5173`
- 监听 `src/electron/**/*.ts` 并持续编译到 `dist-electron/`
- 当 Electron 主进程或预加载输出变化时自动重启客户端
- React 渲染层改动走 Vite HMR，无需重启整个 Electron

### 构建生产资源

```powershell
npm run build
```

这个命令会：

- 把 React + Vite 构建到 `dist/`
- 把 Electron 主进程和预加载脚本编译到 `dist-electron/`

### 本地运行构建结果

```powershell
npm start
```

这个命令会先执行完整构建，再启动 Electron。

### 类型检查

```powershell
npm run typecheck
```

### Windows helper 独立验证

```powershell
npm run helper:build
npm run helper:test
```

当前 Windows helper 位于 `native/win32-helper/`，目录结构：

- `Services/`：业务服务实现（`HealthCheckService`、`CaptureTextService`、`WriteTextService`）
- `Protocols/`：协议请求/响应模型
- `Interop/`：Windows API 互操作封装（UI Automation、剪贴板、输入模拟）

开发模式下由 Electron 主进程通过 `dotnet run --project native/win32-helper/TextBridge.Win32Helper.csproj` 惰性启动。若当前终端 `PATH` 中没有 `dotnet`，主进程会依次尝试：

- `TEXTBRIDGE_DOTNET_PATH`
- `DOTNET_ROOT/dotnet.exe`
- `C:/Program Files/dotnet/dotnet.exe`

已接入的协议命令：

- `health-check`：返回 helper 能力列表
- `capture-text`：文本捕获，支持 `uia`（UI Automation）和 `clipboard` 两种方式
- `write-text`：文本回写
- `clipboard-write`：剪贴板写入

详细手工验证步骤见：

- [docs/plans/2026-03-09-windows-helper-manual-validation.md](docs/plans/2026-03-09-windows-helper-manual-validation.md)
- [docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md](docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md)

## 目录说明

- `src/electron/main.ts`：Electron 主进程入口
- `src/electron/preload.ts`：预加载脚本
- `src/electron/ipc/`：IPC 通道定义与 handler 注册
- `src/electron/services/`：主进程服务层（翻译执行、快捷键、系统托盘、窗口管理）
- `src/electron/services/providers/`：翻译 Provider 实现（MiniMax、Claude、Gemini 等）
- `src/electron/platform/win32/`：Windows 平台适配（Win32 协议、helper session）
- `src/renderer/app/main.tsx`：React 渲染入口
- `src/renderer/app/App.tsx`：React 页面组件
- `src/renderer/features/runtime-status/`：运行状态面板
- `src/renderer/pages/`：页面级视图（设置页、回退结果页、上下文弹窗页）
- `src/core/`：纯业务层（use cases、entities、contracts）
- `src/shared/`：跨进程共享类型与常量
- `vite.config.ts`：Vite 配置
- `tsconfig.json`：React / Vite TypeScript 配置
- `tsconfig.electron.json`：Electron 主进程 TypeScript 配置
- `index.html`：Vite 与 Electron 共用入口页面
- `dist/`：Vite 前端构建产物
- `dist-electron/`：Electron TypeScript 编译产物
- `native/win32-helper/`：Windows 原生 helper（.NET 10.x）

## 产品定位

- 面向多端扩展，当前以桌面客户端为主，首版优先落地 Windows
- 常驻系统托盘，通过全局快捷键触发快速翻译或上下文增强翻译
- 文本获取优先走 `UI Automation`，失败时回退到剪贴板协作
- 回写优先替换或插入原控件，失败时弹窗展示并复制结果
- 平台差异统一收敛到 `src/electron/platform/`，当前实现集中在 `src/electron/platform/win32/`

## MVP 边界

- 当前仓库已完成 Windows MVP 的主要结构边界：共享 DTO、provider 边界、Win32 协议适配、fallback 决策、quick/context runner，以及设置与运行状态 UI 骨架。
- `native/win32-helper` 已接入真实 Windows helper 宿主，并实现 `health-check`、`capture-text`、`write-text`、`clipboard-write` 四类命令。
- 当前首版承诺优先覆盖标准可编辑控件；`replace-selection` 仍保持保守策略，在无法安全确认选区时会明确失败并转入粘贴/弹窗 fallback。
- fallback 结果页和上下文输入页已经具备页面骨架，但完整的独立弹窗交互与 IPC 回传仍需在真实窗口流中继续接线。
- 运行状态面板默认展示已注册快捷键、当前 provider、helper 状态和最近执行摘要，不保存完整原文或译文。

## 当前验证状态

- `npm test`：覆盖 core use case、provider boundary、helper 协议、helper session、win32 adapter、settings service、shortcut service、quick/context runner、runtime status panel 与 fallback 决策。
- `npm run typecheck`：验证 renderer、electron、shared、core 之间的跨层类型契约。
- `dotnet test native/win32-helper/TextBridge.Win32Helper.Tests/TextBridge.Win32Helper.Tests.csproj`：覆盖 helper 宿主、health-check、capture、write-back 和 clipboard-write 的最小行为。
- `npm run build`：验证 Vite renderer 构建与 Electron TypeScript 编译产物路径。
- 主进程诊断日志默认输出到 `app.getPath('userData')/logs/diagnostic.log`。
- helper 诊断日志默认输出到 `native/win32-helper/bin/Debug/net10.0-windows/logs/win32-helper.log`，也可以通过 `TEXTBRIDGE_HELPER_LOG_PATH` 覆盖。
- Windows 真实软件兼容性检查与手工验证步骤请参考：
  - [docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md](docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md)
  - [docs/plans/2026-03-09-windows-helper-manual-validation.md](docs/plans/2026-03-09-windows-helper-manual-validation.md)

详细设计见 [docs/plans/2026-03-08-windows-text-translation-client-design.md](docs/plans/2026-03-08-windows-text-translation-client-design.md)。

当前 helper 设计与实现计划见：

- [docs/plans/2026-03-09-windows-helper-integration-design.md](docs/plans/2026-03-09-windows-helper-integration-design.md)
- [docs/plans/2026-03-09-windows-helper-integration-implementation.md](docs/plans/2026-03-09-windows-helper-integration-implementation.md)

## 开发建议

- 新的系统能力优先放在主进程，再通过 `preload` 暴露给 React
- 不要直接在渲染进程开启 `nodeIntegration`
- 不要手动修改 `dist/` 或 `dist-electron/` 中的生成文件
