# Project AGENTS

本项目采用面向长期扩展的跨平台桌面应用分层结构。

## 目录结构

- `src/core/`：纯业务层，不依赖 Electron、React 或具体操作系统实现
- `src/core/contracts/`：跨层接口、端口与能力约束
- `src/core/entities/`：领域实体与核心数据结构
- `src/core/use-cases/`：面向场景的业务编排
- `src/shared/`：主进程与渲染进程共用的基础代码
- `src/shared/constants/`：共享常量
- `src/shared/types/`：共享类型定义
- `src/shared/utils/`：共享工具函数
- `src/electron/main.ts`：Electron 主进程入口
- `src/electron/preload.ts`：预加载脚本入口
- `src/electron/ipc/`：IPC 通道定义、handler 注册与主进程对外暴露边界
- `src/electron/services/`：主进程服务层，负责系统能力编排与流程组织
- `src/electron/services/providers/`：翻译 Provider 实现与注册中心
- `src/electron/security/`：桥接暴露策略、权限边界与安全相关封装
- `src/electron/platform/`：平台适配层，只在这里处理系统差异
- `src/electron/platform/common/`：多平台共享的适配逻辑
- `src/electron/platform/win32/`：Windows 平台实现
- `src/electron/platform/darwin/`：macOS 平台实现
- `src/electron/platform/linux/`：Linux 平台实现
- `src/renderer/app/`：渲染层应用入口、根组件与全局样式
- `src/renderer/components/`：可复用的基础组件
- `src/renderer/features/`：按功能划分的前端模块
- `src/renderer/layouts/`：页面布局与壳层结构
- `src/renderer/pages/`：页面级视图
- `src/renderer/services/`：渲染层服务、IPC 调用封装与外部访问入口
- `src/renderer/stores/`：前端状态管理
- `src/renderer/types/`：渲染层专用类型定义
- `dist/`：Vite 前端构建产物
- `dist-electron/`：Electron 主进程与预加载脚本编译产物

## 分层规则

- 渲染层不得直接依赖具体平台实现
- 所有系统差异统一收敛到 `src/electron/platform/`
- 渲染层访问桌面能力只能通过 `preload` 暴露的稳定接口
- 主进程优先依赖 `src/core/` 与 `src/shared/`，避免把平台判断散落到业务代码中
- 共享类型优先放到 `src/shared/types/`，仅渲染层专用的类型放到 `src/renderer/types/`
- 可复用 UI 组件放到 `src/renderer/components/`，页面专属组合逻辑放到 `src/renderer/features/`
- 新的系统能力先在 `src/electron/services/` 建立服务边界，再下沉到 `src/electron/platform/`

## 维护约束

- 不要直接编辑 `dist/`、`dist-electron/` 或 `node_modules/`
- 保持 `contextIsolation: true`，不要启用 `nodeIntegration`
- 不要在渲染层散落 `process.platform` 判断
- 需要区分平台时，优先新增适配器，不要复制整套业务流程
- 渲染层优先使用函数式 React 组件与 TypeScript

## 常用命令

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm start`
