# Windows System Text Translation Client Design

**Date:** 2026-03-08  
**Status:** Approved

**Goal:** 构建一款 Windows 优先的系统级文本翻译客户端，通过全局快捷键在尽可能多的标准 Windows 文本控件中完成“获取文本 → 翻译 → 回写/兜底展示”的闭环。

## 1. 已确认产品决策

- 首版平台：仅 `Windows`
- 运行形态：应用常驻系统托盘，主窗口仅负责配置
- 核心能力：全局快捷键触发“快速翻译”和“上下文增强翻译”
- 覆盖目标：尽可能多的标准 Windows 文本控件
- 文本获取：`UI Automation` 优先，失败后回退到“模拟复制 + 剪贴板”
- 回写策略：优先替换或粘贴回原控件，失败时弹窗展示并复制到剪贴板
- 默认输出：用户可配置，默认直接替换原文
- 无选区行为：由用户在设置中配置
- 翻译服务：统一适配层，避免耦合单一供应商
- 语言方向：用户预设源语言与目标语言，可选开启自动检测源语言
- API Key：首版允许普通本地配置文件存储
- OCR：首版不实现，仅保留扩展点
- 平台集成：允许使用 Windows 专用辅助进程

## 2. 推荐总体架构

推荐方案是：

- `Electron` 应用层
  - 托盘、窗口、全局快捷键、IPC、配置界面、弹窗
- `Windows` 辅助进程
  - `UI Automation`、前台控件探测、剪贴板协作、输入模拟
- 统一翻译服务层
  - 抽象供应商、统一请求与响应、按配置切换服务
- 核心业务层
  - 用例编排、错误模型、回退决策、DTO

这是首版最平衡的方案，因为：

- 纯 `Electron + Node` 很难稳定覆盖系统级文本获取与回写
- 纯原生后台服务又会让 MVP 复杂度过高
- 该方案既保留 Electron 的开发效率，又把 Windows 细节收敛到平台边界后面

## 3. 仓库分层映射

### `src/core/`

放纯业务逻辑，不依赖 Electron、React、Windows API。

- `src/core/contracts/`
  - 翻译提供方接口
  - 文本获取接口
  - 回写接口
  - 配置读取接口
- `src/core/entities/`
  - `TranslationRequest`
  - `TranslationResult`
  - `TextCaptureResult`
  - `WriteBackResult`
  - `ExecutionReport`
- `src/core/use-cases/`
  - 快速翻译
  - 上下文增强翻译
  - 文本获取回退决策
  - 回写回退决策

### `src/shared/`

放跨层共享常量与类型。

- `src/shared/constants/`
  - IPC 通道名
  - 默认设置
  - 窗口标识
- `src/shared/types/`
  - 设置结构
  - IPC DTO
  - 运行状态 DTO

### `src/electron/`

负责桌面壳层与流程编排。

- `src/electron/main.ts`
  - 应用启动、托盘、快捷键、窗口生命周期
- `src/electron/ipc/`
  - 渲染层可调用能力的注册与边界
- `src/electron/services/`
  - 配置服务
  - 快捷键服务
  - 翻译编排服务
  - 弹窗服务
  - 托盘服务
  - 系统交互门面
  - 辅助进程会话服务
- `src/electron/security/`
  - `preload` 暴露白名单
- `src/electron/platform/win32/`
  - Windows 平台适配器
  - 辅助进程协议封装

### `src/renderer/`

只做配置和状态展示，不直接接触平台实现。

- 设置页
- 快捷键设置
- 语言设置
- 结果弹窗
- 运行状态面板

## 4. 核心组件

- **快捷键协调器**
  - 注册两个全局快捷键
  - 路由到对应用例
- **系统交互门面**
  - 向上暴露稳定接口，向下调用 `win32` 适配器
- **Windows 平台适配器**
  - 封装辅助进程通信与结果归一化
- **Windows 辅助进程**
  - 实际负责 `UI Automation`、剪贴板回退与输入模拟
- **翻译编排服务**
  - 读取设置、构造请求、调用统一翻译层、处理回写
- **统一翻译适配层**
  - 统一不同供应商的输入、输出和错误
- **配置服务**
  - 读写本地配置文件，维护默认值和校验
- **托盘/弹窗服务**
  - 管理托盘菜单、设置页、增强输入弹窗、兜底结果弹窗

## 5. 核心数据对象

建议从一开始固定这些 DTO：

- `TextCaptureRequest`
- `TextCaptureResult`
- `TranslationRequest`
- `TranslationResult`
- `WriteBackRequest`
- `WriteBackResult`
- `AppSettings`
- `ExecutionReport`

建议字段至少覆盖：

- 当前模式
- 捕获策略
- 回写策略
- 供应商标识
- 检测到的源语言
- 失败阶段
- 结构化错误码

## 6. 数据流设计

### 快速翻译

1. 全局快捷键触发
2. 主进程读取当前生效配置
3. 系统交互层按优先级捕获文本
4. 翻译编排服务构造统一翻译请求
5. 统一翻译适配层执行翻译
6. 主进程尝试回写
7. 失败则显示结果弹窗并复制到剪贴板
8. 记录执行报告

### 上下文增强翻译

1. 全局快捷键触发
2. 主进程先尝试捕获当前文本
3. 打开轻量弹窗，预填原文和语言设置
4. 用户补充语气、领域、风格等上下文
5. 翻译编排服务构造增强翻译请求
6. 翻译后尝试回写
7. 回写失败则保留结果于弹窗并复制到剪贴板

## 7. Fallback 链

### 文本获取 fallback

1. `UI Automation` 读取选区
2. 读取可编辑控件上下文或全文
3. 模拟复制并读取剪贴板
4. 按用户配置处理“无选区”场景
5. 预留 OCR 扩展点

### 回写 fallback

1. 替换当前选区
2. 在光标处插入
3. 模拟粘贴
4. 结果弹窗 + 自动复制到剪贴板

每一步都必须返回结构化结果，而不是简单布尔值。

## 8. 错误模型与可观测性

错误分为四类：

- 文本获取失败
- 翻译服务失败
- 回写失败
- 基础设施失败

建议统一错误码：

- `TEXT_CAPTURE_NO_FOCUS`
- `TEXT_CAPTURE_NO_SELECTION`
- `TEXT_CAPTURE_UIA_UNSUPPORTED`
- `TEXT_CAPTURE_CLIPBOARD_FAILED`
- `TRANSLATION_PROVIDER_UNAVAILABLE`
- `TRANSLATION_AUTH_FAILED`
- `TRANSLATION_TIMEOUT`
- `WRITE_BACK_TARGET_LOST`
- `WRITE_BACK_REPLACE_FAILED`
- `WRITE_BACK_PASTE_FAILED`
- `AUX_PROCESS_UNAVAILABLE`

执行状态建议固定为：

- `idle`
- `capturing_text`
- `translating`
- `writing_back`
- `fallback_presenting`
- `completed`
- `failed`

日志建议分两层：

- 用户级最近执行记录
- 开发级主进程/辅助进程诊断日志

默认不记录完整原文或译文，仅记录长度、错误码、策略和必要摘要。

## 9. MVP 边界

### 首版包含

- Windows 平台
- 托盘常驻
- 两个全局快捷键
- 本地配置文件
- 统一翻译适配层
- `UI Automation` + 剪贴板回退
- 替换/插入/粘贴回写尝试
- 失败时结果弹窗与复制剪贴板

### 首版不包含

- macOS 或 Linux 支持
- OCR 真正实现
- API Key 系统安全存储
- 富文本样式保留
- 历史翻译管理
- 术语库与多轮会话

## 10. 测试策略

- **核心层单元测试**
  - 请求组装
  - fallback 决策
  - 错误映射
- **主进程服务集成测试**
  - 快捷键触发
  - 文本获取失败回退
  - 翻译成功但回写失败时的兜底行为
- **Windows 兼容性手工验证**
  - 原生文本框
  - 浏览器输入框
  - Electron/Chromium 输入框
  - Office/WPS
  - 聊天应用输入框
  - IDE 编辑器
- **渲染层组件测试**
  - 设置表单
  - 弹窗状态
  - 运行状态展示

## 11. 实施顺序

1. 搭建共享类型、默认配置和 IPC 常量
2. 建立本地配置持久化和 `preload` API
3. 建立统一翻译适配边界与一个可工作的 provider
4. 打通快速翻译最小闭环
5. 加入托盘与全局快捷键
6. 引入 Windows 辅助进程边界
7. 实现捕获与回写 fallback 链
8. 实现上下文增强弹窗流程
9. 增加诊断信息与兼容性矩阵

## 12. 运行约束

- 保持 `contextIsolation: true`
- 不启用 `nodeIntegration`
- 渲染层不直接做平台判断
- 平台差异只收敛在 `src/electron/platform/`
- 不直接编辑 `dist/`、`dist-electron/`、`node_modules/`

**操作说明：** 当前工作区不是 Git 仓库，因此本设计文档无法在本环境中执行提交；若后续初始化 Git 或迁入已有仓库，可补做提交。
