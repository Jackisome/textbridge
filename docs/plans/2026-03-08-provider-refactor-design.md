# Translation Provider Refactor Design

**Date:** 2026-03-08  
**Status:** Approved

**Goal:** 参考 FluentRead `entrypoints/service` 的 provider 组织方式，重构 TextBridge 的翻译 provider 体系、设置模型与设置页，使其能稳定支持 `claude`、`deepseek`、`minimax`、`gemini`、`google`、`tencent`、`tongyi`、`custom`，并为后续继续扩展更多 provider 留出一致边界。

## 1. 已确认范围

- 当前项目仍处于开发阶段，不需要兼容旧版配置结构
- 本次不是“补几个 provider 枚举值”，而是一次完整的 provider 架构重构
- 需要参考 FluentRead 的实现方式
- 需要同步重构：
  - 共享设置模型
  - 主进程 provider 调用边界
  - provider 配置持久化
  - 设置页 UI 与交互
- 设置页需要引入 `frontend-design` 的设计要求，进行必要的前端重构

## 2. 参考结论

FluentRead `entrypoints/service` 的核心思路不是“每个 provider 完全独立、自成体系”，而是：

- 用统一注册表做 provider 分发
- 能共享协议的 provider 走公共适配逻辑
- 只有协议差异明显的 provider 才单独实现

从代码看，以下模式最值得吸收：

- `common.ts` 负责 OpenAI 兼容类请求与结果解析
- `claude.ts`、`gemini.ts`、`google.ts`、`tencent.ts`、`tongyi.ts`、`minimax.ts` 负责差异化协议
- `_service.ts` 负责按 provider 标识映射到具体实现
- `template.ts` 负责把翻译提示词和请求体模板集中管理

TextBridge 会保留这些思想，但不会照搬浏览器扩展中的全局 `config` 写法，也不会把 provider 逻辑泄漏到渲染层。

## 3. 推荐方案

推荐采用“注册表 + 通用协议适配器 + 少数特例 provider”的重构方案。

### 方案对比

#### 方案 A：注册表 + 公共适配器 + 特例 provider

优点：

- 最接近 FluentRead 的实现方式
- 适配多家 provider 时扩展成本最低
- 可把共用协议的 provider 收敛到统一测试和错误边界
- 适合 TextBridge 当前的 Electron 分层

缺点：

- 改动面中等，需要同步更新设置、主进程服务和设置页

#### 方案 B：继续沿用扁平设置模型，只追加字段

优点：

- 短期修改量最小

缺点：

- 很快会被腾讯 `SecretId/SecretKey`、Gemini 特殊 URL、Google 无鉴权等差异拖垮
- 设置页会持续膨胀
- provider 之间的逻辑边界会越来越模糊

#### 方案 C：完全动态 schema 驱动

优点：

- 理论灵活性最高

缺点：

- 对当前项目属于过度设计
- 初期调试和测试成本过高
- 会把问题从“provider 实现”转移到“元数据框架维护”

**结论：采用方案 A。**

## 4. 架构设计

### 4.1 分层原则

- `src/shared/` 负责 provider 标识、设置结构、默认配置和共享元数据
- `src/electron/services/providers/` 负责 provider 实现与协议归一化
- `src/electron/services/translation-provider-service.ts` 负责 provider 选择、执行、超时与错误映射
- `src/renderer/` 只负责展示配置和收集输入，不直接感知具体协议细节

### 4.2 目录调整

建议新增或重构以下文件：

- `src/shared/types/provider.ts`
- `src/shared/types/settings.ts`
- `src/shared/constants/default-settings.ts`
- `src/shared/constants/provider-metadata.ts`
- `src/shared/utils/prompt-template.ts`
- `src/electron/services/providers/provider-registry.ts`
- `src/electron/services/providers/types.ts`
- `src/electron/services/providers/openai-compatible-provider.ts`
- `src/electron/services/providers/claude-provider.ts`
- `src/electron/services/providers/deepseek-provider.ts`
- `src/electron/services/providers/minimax-provider.ts`
- `src/electron/services/providers/gemini-provider.ts`
- `src/electron/services/providers/google-provider.ts`
- `src/electron/services/providers/tencent-provider.ts`
- `src/electron/services/providers/tongyi-provider.ts`
- `src/electron/services/providers/custom-provider.ts`
- `src/electron/services/providers/mock-provider.ts`
- `src/electron/services/translation-provider-service.ts`

### 4.3 统一调用流

主进程的 provider 调用流固定为：

1. 读取当前全量设置
2. 根据 `activeProviderId` 取出当前 provider 配置
3. 构造统一 `ProviderExecutionContext`
4. 通过注册表选择 provider
5. 执行翻译请求
6. 将响应归一化为统一结果结构
7. 将底层异常映射为结构化 provider 错误

这样可以保证：

- 上层业务不需要知道每家 provider 的协议差异
- 设置页和翻译执行服务之间只通过稳定设置结构交互
- 后续增加 provider 时不会继续污染主进程编排逻辑

## 5. 设置模型

本次直接替换当前扁平设置结构，不做旧结构兼容。

### 5.1 顶层公共设置

顶层只保留真正跨 provider 的设置：

- `sourceLanguage`
- `targetLanguage`
- `activeProviderId`
- `quickTranslateShortcut`
- `contextTranslateShortcut`
- `outputMode`
- `captureMode`
- `closeToTray`
- `startMinimized`
- `enableClipboardFallback`
- `enablePopupFallback`
- `providers`

### 5.2 Provider 标识

建议 provider 标识定义为：

- `mock`
- `claude`
- `deepseek`
- `minimax`
- `gemini`
- `google`
- `tencent`
- `tongyi`
- `custom`

如果后续扩展难度不大，可继续加入：

- `openai`
- `moonshot`
- `zhipu`
- `groq`
- `openrouter`
- `baichuan`
- `lingyi`

### 5.3 Provider 专属配置

每个 provider 各自维护一份明确配置，不共享无意义字段。

#### `claude`

- `apiKey`
- `model`
- `baseUrl`
- `systemPrompt`
- `userPromptTemplate`
- `timeoutMs`

#### `deepseek`

- `apiKey`
- `model`
- `baseUrl`
- `systemPrompt`
- `userPromptTemplate`
- `timeoutMs`

#### `minimax`

- `apiKey`
- `model`
- `baseUrl`
- `systemPrompt`
- `userPromptTemplate`
- `timeoutMs`

#### `gemini`

- `apiKey`
- `model`
- `baseUrl`
- `userPromptTemplate`
- `timeoutMs`

#### `google`

- `baseUrl`
- `timeoutMs`

#### `tencent`

- `secretId`
- `secretKey`
- `region`
- `baseUrl`
- `timeoutMs`

#### `tongyi`

- `apiKey`
- `model`
- `baseUrl`
- `systemPrompt`
- `userPromptTemplate`
- `timeoutMs`

#### `custom`

- `apiKey`
- `model`
- `baseUrl`
- `requestFormat`
- `systemPrompt`
- `userPromptTemplate`
- `timeoutMs`

#### `mock`

- `prefix`
- `latencyMs`

### 5.4 建模原则

- `baseUrl` 尽量保留在所有需要联网的 provider 上，统一支持代理、中转和私有部署
- `systemPrompt` 和 `userPromptTemplate` 作为可配置项保存，不写死在 provider 实现中
- `custom` 第一版明确为“自定义 OpenAI 兼容接口”，不扩展成任意协议解释器

## 6. Provider 分类与实现策略

### 6.1 OpenAI 兼容类

推荐走公共适配器：

- `deepseek`
- `custom`
- 可选扩展：`openai`、`moonshot`、`zhipu`、`groq`、`openrouter`

公共适配器负责：

- Bearer 鉴权
- Chat Completions 风格请求体
- 标准 `choices[0].message.content` 解析
- 超时控制
- 基础 HTTP 错误格式化

其中 `deepseek` 只保留轻量定制，例如 `deepseek-reasoner` 不带 `temperature`。

### 6.2 协议差异明显的 LLM 类

单独实现：

- `claude`
- `gemini`
- `tongyi`
- `minimax`

原因：

- `claude` 需要 `x-api-key` 与 `anthropic-version`
- `gemini` 走 `generateContent`
- `tongyi` 存在兼容模式与 `qwen-mt-*` 专用格式差异
- `minimax` 的请求 URL 与常见 OpenAI 兼容接口不同

### 6.3 传统机器翻译类

单独实现：

- `google`
- `tencent`

原因：

- `google` 是 GET 请求，返回值为数组嵌套结构
- `tencent` 需要 `TC3-HMAC-SHA256` 签名和语言代码映射

### 6.4 调试类

- `mock`

用于：

- 开发阶段联调
- 设置页逻辑验证
- 主进程流程验证
- 端到端测试中的稳定替身

## 7. 统一接口与错误模型

### 7.1 Provider 接口

每个 provider 都实现同一个接口：

- `id`
- `translate(context)`

输入上下文至少包含：

- 原始文本
- 源语言
- 目标语言
- 当前 provider 配置
- 渲染后的提示词
- `AbortSignal`
- 可注入 `fetch`

输出统一为：

- `text`
- `detectedSourceLanguage?`
- `raw?`

### 7.2 错误类型

主进程不直接向上抛裸 `fetch` 异常，统一映射为：

- `ProviderConfigError`
- `ProviderAuthError`
- `ProviderNetworkError`
- `ProviderResponseError`

这样后续：

- 设置页可以做更可理解的错误提示
- 翻译执行链可以基于错误类型决定重试或兜底
- 测试不需要依赖具体 provider 的原始错误文本

## 8. 提示词与请求模板

参考 FluentRead `template.ts` 的做法，但收敛到 TextBridge 的共享层。

建议：

- 新增共享提示词模板渲染工具
- 用统一变量占位：
  - `{{to}}`
  - `{{origin}}`
- 默认用户提示词保留：
  - 要求翻译成目标语言
  - 若无需翻译则返回原文
  - 不要解释、不要附注

这样可以做到：

- 多个 provider 共用同一套翻译语义
- 不在 provider 实现里重复拼接用户指令
- 设置页可直接编辑提示词模板

## 9. 设置页与前端设计

本次设置页设计要遵守 `frontend-design` 的要求，但保持当前已建立的浅色工具型设置中心方向。

### 9.1 视觉方向

- 浅色专业工具台
- 以桌面生产力软件为目标气质
- 保留左侧导航 + 右侧卡片布局
- 重点强化 provider 区域的信息层级

### 9.2 页面结构

左侧导航固定为：

- 常规
- 翻译
- Provider
- 快捷键
- 运行状态

右侧主区域按卡片分区：

- 常规设置
- 翻译偏好
- Provider 选择器
- 当前 Provider 配置
- 快捷键设置
- 运行状态

### 9.3 Provider 区交互

不再使用单个下拉框承担全部 provider 选择。

改为两段式：

1. `Provider 选择器`
   - 使用一组 provider tiles
   - 每张 tile 展示：
     - provider 名称
     - 类型标签：`LLM` / `机器翻译` / `调试`
     - 一句简短说明
2. `当前 Provider 配置卡`
   - 只展示当前选中 provider 相关字段
   - 按以下分组展示：
     - 凭证
     - 连接入口
     - 模型与提示词
     - 高级选项

### 9.4 表单规则

- 切换 provider 不会丢失其他 provider 已填写的配置
- 保存按钮继续采用全局保存
- 必填字段在当前 provider 卡片中直接标出
- `apiKey`、`secretKey` 默认遮罩，可切换显示
- `systemPrompt`、`userPromptTemplate` 使用多行输入区
- 对 Google 这类不需要 `apiKey/model` 的 provider，不显示无关字段

### 9.5 记忆点

这次前端的记忆点放在 provider 区：

- 一眼能看出支持哪些翻译引擎
- 一眼能看出当前引擎属于哪一类
- 一眼能看出当前引擎需要填写什么

目标是把页面做成“翻译引擎控制面板”，而不是一张普通设置表单。

## 10. 持久化与桥接 API

渲染层继续通过 `preload` 暴露的稳定接口访问设置，不直接接触 Node API。

保持：

- `window.textBridge.getSettings()`
- `window.textBridge.saveSettings(settings)`

主进程继续把配置写入：

- `app.getPath('userData')/settings.json`

这次需要同步更新：

- 设置默认值
- 配置归一化逻辑
- 渲染层 `clone` / `equal` / `load` / `save` 辅助函数

## 11. 测试策略

### 11.1 主进程 provider 测试

至少覆盖：

- 注册表能按 `activeProviderId` 取到实现
- OpenAI 兼容类 provider 生成正确请求体
- `claude` 头部和响应解析正确
- `gemini` URL 和响应解析正确
- `google` 数组结果拼接正确
- `tencent` 签名请求最少做单元级验证
- `tongyi` 普通模型与 `qwen-mt-*` 模型路径正确
- `custom` 使用自定义 `baseUrl`

### 11.2 设置服务测试

至少覆盖：

- 新 settings 结构可正确读写
- 默认 provider 配置完整返回
- 不合法字段被归一化到默认值

### 11.3 渲染层设置页测试

至少覆盖：

- 切换不同 provider 时显示正确字段
- Google 不显示无关凭证和模型字段
- Tencent 显示 `secretId`、`secretKey`、`region`
- Custom 显示协议相关字段
- 切换 provider 后不会丢失该 provider 既有输入
- 保存时提交完整 settings 结构

## 12. 实施边界

### 本次必须完成

- 新的 provider 设置结构
- 新的 provider 注册表和适配器层
- 至少实现：
  - `claude`
  - `deepseek`
  - `minimax`
  - `gemini`
  - `google`
  - `tencent`
  - `tongyi`
  - `custom`
  - `mock`
- 设置页 provider 区重构
- 必要的单元测试与组件测试

### 本次可选扩展

若实现难度不大，可继续加入：

- `openai`
- `moonshot`
- `zhipu`
- `groq`
- `openrouter`
- `baichuan`
- `lingyi`

### 本次不做

- 任意协议的自定义响应路径解释器
- 云端同步设置
- API Key 安全存储
- 渲染层直接发 provider 请求

## 13. 成功标准

完成后应满足：

- 设置页可切换多家 provider，并显示对应配置项
- 配置可稳定保存和重新载入
- 主进程可根据当前 provider 正确构造请求
- 至少 8 个指定 provider 有独立可测实现
- 代码结构允许后续继续补更多 provider，而不需要再重做 settings 结构
