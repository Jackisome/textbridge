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

### 开发辅助工具

- `concurrently`：并行启动 Vite、Electron TypeScript watch 与 Electron 进程
- `nodemon`：监听 `dist-electron/` 变化并自动重启 Electron
- `wait-on`：等待 Vite 服务与 Electron 编译输出准备完成
- `cross-env`：为 Electron 开发进程注入跨平台环境变量

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

## 目录说明

- `src/electron/main.ts`：Electron 主进程入口
- `src/electron/preload.ts`：预加载脚本
- `src/renderer/app/main.tsx`：React 渲染入口
- `src/renderer/app/App.tsx`：React 页面组件
- `src/renderer/app/styles.css`：渲染层样式
- `src/renderer/types/vite-env.d.ts`：渲染层全局类型声明
- `vite.config.ts`：Vite 配置
- `tsconfig.json`：React / Vite TypeScript 配置
- `tsconfig.electron.json`：Electron 主进程 TypeScript 配置
- `index.html`：Vite 与 Electron 共用入口页面
- `dist/`：Vite 前端构建产物
- `dist-electron/`：Electron TypeScript 编译产物

## 产品定位

- 面向多端扩展，当前以桌面客户端为主，首版优先落地 Windows
- 常驻系统托盘，通过全局快捷键触发快速翻译或上下文增强翻译
- 文本获取优先走 `UI Automation`，失败时回退到剪贴板协作
- 回写优先替换或插入原控件，失败时弹窗展示并复制结果
- 平台差异统一收敛到 `src/electron/platform/`，当前实现集中在 `src/electron/platform/win32/`

## MVP 边界

- 当前仓库已完成 Windows MVP 的主要结构边界：共享 DTO、provider 边界、Win32 协议适配、fallback 决策、quick/context runner，以及设置与运行状态 UI 骨架。
- 真实 Windows 辅助进程仍为后续接入项；当前 `src/electron/platform/win32/` 通过可注入 transport/stub 保持协议与测试稳定。
- fallback 结果页和上下文输入页已经具备页面骨架，但完整的独立弹窗交互与 IPC 回传仍需在真实窗口流中继续接线。
- 运行状态面板默认展示已注册快捷键、当前 provider 和最近执行摘要，不保存完整原文或译文。

## 当前验证状态

- `npm test`：覆盖 core use case、provider boundary、win32 adapter、settings service、shortcut service、quick/context runner、fallback 决策与执行记录服务。
- `npm run typecheck`：验证 renderer、electron、shared、core 之间的跨层类型契约。
- `npm run build`：验证 Vite renderer 构建与 Electron TypeScript 编译产物路径。
- Windows 真实软件兼容性检查请参考 [docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md](docs/plans/2026-03-08-windows-text-translation-compatibility-matrix.md)。

详细设计见 [docs/plans/2026-03-08-windows-text-translation-client-design.md](docs/plans/2026-03-08-windows-text-translation-client-design.md)。

## 开发建议

- 新的系统能力优先放在主进程，再通过 `preload` 暴露给 React
- 不要直接在渲染进程开启 `nodeIntegration`
- 不要手动修改 `dist/` 或 `dist-electron/` 中的生成文件
