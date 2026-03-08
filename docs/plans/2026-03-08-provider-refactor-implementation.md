# Translation Provider Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构 TextBridge 的翻译 provider 架构、设置模型和设置页，使应用能以统一边界支持 `claude`、`deepseek`、`minimax`、`gemini`、`google`、`tencent`、`tongyi`、`custom`、`mock`，并为继续扩展更多 provider 保留稳定结构。

**Architecture:** 共享层定义 provider 标识、默认配置和设置结构；主进程通过 provider 注册表和统一执行上下文调度具体实现；渲染层只负责 provider 选择和配置收集，所有网络调用和鉴权逻辑继续收敛在主进程。设置页按 `frontend-design` 的浅色工具型工作台方向重构，强化 provider 选择器与当前 provider 配置卡的层级。

**Tech Stack:** TypeScript、Electron、React、Vite、Vitest、Testing Library、本地 JSON 设置文件、Node `fetch`、Electron `contextBridge`。

---

### Task 1: 重建 provider 共享类型与默认设置

**Files:**
- Create: `src/shared/types/provider.ts`
- Create: `src/shared/constants/provider-metadata.ts`
- Modify: `src/shared/types/settings.ts`
- Modify: `src/shared/constants/default-settings.ts`
- Modify: `src/renderer/types/settings.ts`
- Modify: `src/shared/types/preload.ts`
- Test: `src/electron/services/settings-service.test.ts`

**Step 1: Write the failing test**

先在 `src/electron/services/settings-service.test.ts` 增加对新 settings 结构的断言：

```ts
expect(settings.activeProviderId).toBe('mock');
expect(settings.providers.claude.apiKey).toBe('');
expect(settings.providers.tencent.region).toBe('ap-beijing');
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/settings-service.test.ts`
Expected: FAIL，提示 `activeProviderId` 或 `providers` 结构不存在。

**Step 3: Write minimal implementation**

在共享层定义新的 provider 基础类型：

```ts
export type ProviderId =
  | 'mock'
  | 'claude'
  | 'deepseek'
  | 'minimax'
  | 'gemini'
  | 'google'
  | 'tencent'
  | 'tongyi'
  | 'custom';
```

同时把 `TranslationClientSettings` 改成：

```ts
export interface TranslationClientSettings {
  sourceLanguage: string;
  targetLanguage: string;
  activeProviderId: ProviderId;
  quickTranslateShortcut: string;
  contextTranslateShortcut: string;
  outputMode: OutputMode;
  captureMode: CaptureMode;
  closeToTray: boolean;
  startMinimized: boolean;
  enableClipboardFallback: boolean;
  enablePopupFallback: boolean;
  providers: ProviderSettingsMap;
}
```

补齐各 provider 的默认配置和显示元数据。

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/settings-service.test.ts`
Expected: PASS。

Run: `npm run typecheck`
Expected: FAIL，仍会有 settings 读取逻辑和 UI 使用旧字段的报错。

**Step 5: Commit**

```bash
git add src/shared/types/provider.ts src/shared/constants/provider-metadata.ts src/shared/types/settings.ts src/shared/constants/default-settings.ts src/renderer/types/settings.ts src/shared/types/preload.ts src/electron/services/settings-service.test.ts
git commit -m "feat(settings): redefine provider settings model"
```

---

### Task 2: 重写设置持久化与归一化逻辑

**Files:**
- Modify: `src/electron/services/settings-service.ts`
- Modify: `src/electron/ipc/register-settings-ipc.ts`
- Modify: `src/electron/preload.ts`
- Modify: `src/renderer/services/settings-storage.ts`
- Modify: `src/renderer/app/App.tsx`
- Test: `src/electron/services/settings-service.test.ts`
- Test: `src/renderer/app/App.test.tsx`

**Step 1: Write the failing test**

在设置服务测试里增加保存和回读整棵 `providers` 树的断言：

```ts
await service.saveSettings({
  ...defaultTranslationClientSettings,
  activeProviderId: 'claude',
  providers: {
    ...defaultTranslationClientSettings.providers,
    claude: {
      ...defaultTranslationClientSettings.providers.claude,
      apiKey: 'test-key'
    }
  }
});
```

在 `App.test.tsx` 增加断言：

```tsx
expect(window.textBridge.getSettings).toHaveBeenCalled();
expect(window.textBridge.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
  activeProviderId: 'claude'
}));
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/settings-service.test.ts src/renderer/app/App.test.tsx`
Expected: FAIL，旧版服务无法读写新结构。

**Step 3: Write minimal implementation**

重写 `normalizeSettings`，按新结构分别归一化：

- 顶层公共字段
- `providers.claude`
- `providers.deepseek`
- `providers.minimax`
- `providers.gemini`
- `providers.google`
- `providers.tencent`
- `providers.tongyi`
- `providers.custom`
- `providers.mock`

保持桥接 API 不变：

```ts
getSettings(): Promise<TranslationClientSettings>
saveSettings(settings: TranslationClientSettings): Promise<void>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/settings-service.test.ts src/renderer/app/App.test.tsx`
Expected: PASS。

Run: `npm run typecheck`
Expected: FAIL，仍会有设置页旧字段引用报错。

**Step 5: Commit**

```bash
git add src/electron/services/settings-service.ts src/electron/ipc/register-settings-ipc.ts src/electron/preload.ts src/renderer/services/settings-storage.ts src/renderer/app/App.tsx src/electron/services/settings-service.test.ts src/renderer/app/App.test.tsx
git commit -m "feat(settings): persist nested provider configs"
```

---

### Task 3: 提取提示词模板与 provider 执行上下文

**Files:**
- Create: `src/shared/utils/prompt-template.ts`
- Create: `src/electron/services/providers/types.ts`
- Create: `src/electron/services/providers/provider-errors.ts`
- Test: `src/electron/services/providers/provider-types.test.ts`

**Step 1: Write the failing test**

新增测试，断言提示词模板和统一上下文可用：

```ts
expect(renderPrompt('Translate {{origin}} to {{to}}', {
  origin: 'hello',
  to: 'zh-CN'
})).toBe('Translate hello to zh-CN');
```

以及错误映射：

```ts
expect(createProviderConfigError('missing key').code).toBe('PROVIDER_CONFIG_ERROR');
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/providers/provider-types.test.ts`
Expected: FAIL，因为类型与工具尚未存在。

**Step 3: Write minimal implementation**

实现：

- 提示词模板渲染函数
- `ProviderExecutionContext`
- `ProviderTranslationResult`
- `TranslationProvider` 接口
- `ProviderConfigError`
- `ProviderAuthError`
- `ProviderNetworkError`
- `ProviderResponseError`

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/providers/provider-types.test.ts`
Expected: PASS。

Run: `npm run typecheck`
Expected: PASS 或仅剩 provider 实现缺失错误。

**Step 5: Commit**

```bash
git add src/shared/utils/prompt-template.ts src/electron/services/providers/types.ts src/electron/services/providers/provider-errors.ts src/electron/services/providers/provider-types.test.ts
git commit -m "feat(provider): add shared execution context and errors"
```

---

### Task 4: 建立 provider 注册表与 mock provider

**Files:**
- Create: `src/electron/services/providers/provider-registry.ts`
- Create: `src/electron/services/providers/mock-provider.ts`
- Create: `src/electron/services/translation-provider-service.ts`
- Test: `src/electron/services/translation-provider-service.test.ts`

**Step 1: Write the failing test**

新增测试验证注册表和最小执行路径：

```ts
const result = await service.translateWithSettings({
  text: 'Hello world',
  settings: {
    ...defaultTranslationClientSettings,
    activeProviderId: 'mock'
  }
});

expect(result.text).toContain('Hello world');
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/translation-provider-service.test.ts`
Expected: FAIL，因为服务和注册表尚未存在。

**Step 3: Write minimal implementation**

先让统一服务支持最小闭环：

- 注册表用 `Map<ProviderId, TranslationProvider>`
- `mock-provider` 返回可预测文本
- `translation-provider-service` 根据 `activeProviderId` 执行 provider

接口建议固定为：

```ts
translateWithSettings(input: {
  text: string;
  settings: TranslationClientSettings;
}): Promise<ProviderTranslationResult>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/translation-provider-service.test.ts`
Expected: PASS。

Run: `npm test`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/services/providers/provider-registry.ts src/electron/services/providers/mock-provider.ts src/electron/services/translation-provider-service.ts src/electron/services/translation-provider-service.test.ts
git commit -m "feat(provider): add registry and mock translation path"
```

---

### Task 5: 实现 OpenAI 兼容 provider 基座与 DeepSeek/Custom

**Files:**
- Create: `src/electron/services/providers/openai-compatible-provider.ts`
- Create: `src/electron/services/providers/deepseek-provider.ts`
- Create: `src/electron/services/providers/custom-provider.ts`
- Modify: `src/electron/services/providers/provider-registry.ts`
- Test: `src/electron/services/providers/openai-compatible-provider.test.ts`
- Test: `src/electron/services/providers/deepseek-provider.test.ts`
- Test: `src/electron/services/providers/custom-provider.test.ts`

**Step 1: Write the failing test**

分别写三个最小测试：

```ts
expect(fetchMock).toHaveBeenCalledWith(
  'https://api.deepseek.com/chat/completions',
  expect.objectContaining({
    method: 'POST'
  })
);
```

```ts
expect(result.text).toBe('translated');
```

```ts
expect(customRequest.body).toContain('Translate');
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/providers/openai-compatible-provider.test.ts src/electron/services/providers/deepseek-provider.test.ts src/electron/services/providers/custom-provider.test.ts`
Expected: FAIL。

**Step 3: Write minimal implementation**

实现公共适配器：

- Bearer 鉴权
- Chat Completions 请求体
- 标准响应解析
- 空结果校验
- 网络错误和响应错误映射

`deepseek-provider` 只负责：

- 注入默认 `baseUrl`
- 对 `deepseek-reasoner` 跳过 `temperature`

`custom-provider` 只负责：

- 使用用户配置的 `baseUrl`
- 支持 `requestFormat = 'openai-chat'`

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/providers/openai-compatible-provider.test.ts src/electron/services/providers/deepseek-provider.test.ts src/electron/services/providers/custom-provider.test.ts`
Expected: PASS。

Run: `npm test`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/services/providers/openai-compatible-provider.ts src/electron/services/providers/deepseek-provider.ts src/electron/services/providers/custom-provider.ts src/electron/services/providers/provider-registry.ts src/electron/services/providers/openai-compatible-provider.test.ts src/electron/services/providers/deepseek-provider.test.ts src/electron/services/providers/custom-provider.test.ts
git commit -m "feat(provider): add deepseek and custom adapters"
```

---

### Task 6: 实现 Claude、Gemini、Tongyi、MiniMax provider

**Files:**
- Create: `src/electron/services/providers/claude-provider.ts`
- Create: `src/electron/services/providers/gemini-provider.ts`
- Create: `src/electron/services/providers/tongyi-provider.ts`
- Create: `src/electron/services/providers/minimax-provider.ts`
- Modify: `src/electron/services/providers/provider-registry.ts`
- Test: `src/electron/services/providers/claude-provider.test.ts`
- Test: `src/electron/services/providers/gemini-provider.test.ts`
- Test: `src/electron/services/providers/tongyi-provider.test.ts`
- Test: `src/electron/services/providers/minimax-provider.test.ts`

**Step 1: Write the failing test**

示例断言：

```ts
expect(request.headers['x-api-key']).toBe('claude-key');
expect(result.text).toBe('Claude output');
```

```ts
expect(url).toContain(':generateContent');
expect(result.text).toBe('Gemini output');
```

```ts
expect(JSON.parse(body).model).toBe('qwen-plus');
expect(mtBody.translation_options.target_lang).toBe('zh');
```

```ts
expect(url).toContain('/v1/text/chatcompletion_v2');
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/providers/claude-provider.test.ts src/electron/services/providers/gemini-provider.test.ts src/electron/services/providers/tongyi-provider.test.ts src/electron/services/providers/minimax-provider.test.ts`
Expected: FAIL。

**Step 3: Write minimal implementation**

分别实现：

- `claude-provider`
  - `x-api-key`
  - `anthropic-version`
  - `content[0].text`
- `gemini-provider`
  - `generateContent`
  - `candidates[0].content.parts[0].text`
- `tongyi-provider`
  - 普通模型走兼容模式消息体
  - `qwen-mt-*` 走翻译专用请求体
- `minimax-provider`
  - URL 尾段使用模型名
  - 解析 `choices[0].message.content`

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/providers/claude-provider.test.ts src/electron/services/providers/gemini-provider.test.ts src/electron/services/providers/tongyi-provider.test.ts src/electron/services/providers/minimax-provider.test.ts`
Expected: PASS。

Run: `npm test`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/services/providers/claude-provider.ts src/electron/services/providers/gemini-provider.ts src/electron/services/providers/tongyi-provider.ts src/electron/services/providers/minimax-provider.ts src/electron/services/providers/provider-registry.ts src/electron/services/providers/claude-provider.test.ts src/electron/services/providers/gemini-provider.test.ts src/electron/services/providers/tongyi-provider.test.ts src/electron/services/providers/minimax-provider.test.ts
git commit -m "feat(provider): add claude gemini tongyi and minimax"
```

---

### Task 7: 实现 Google 与 Tencent provider

**Files:**
- Create: `src/electron/services/providers/google-provider.ts`
- Create: `src/electron/services/providers/tencent-provider.ts`
- Modify: `src/electron/services/providers/provider-registry.ts`
- Test: `src/electron/services/providers/google-provider.test.ts`
- Test: `src/electron/services/providers/tencent-provider.test.ts`

**Step 1: Write the failing test**

示例断言：

```ts
expect(fetchMock).toHaveBeenCalledWith(
  expect.stringContaining('translate_a/single'),
  expect.objectContaining({ method: 'GET' })
);
```

```ts
expect(headers['X-TC-Action']).toBe('TextTranslate');
expect(headers.Authorization).toContain('TC3-HMAC-SHA256');
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/providers/google-provider.test.ts src/electron/services/providers/tencent-provider.test.ts`
Expected: FAIL。

**Step 3: Write minimal implementation**

实现：

- `google-provider`
  - GET 请求
  - 根据数组结果拼接译文
- `tencent-provider`
  - 语言代码映射
  - `TC3-HMAC-SHA256` 签名
  - `TextTranslate` 请求体与头部
  - `Response.TargetText` 解析

把这两个 provider 注册到注册表中。

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/providers/google-provider.test.ts src/electron/services/providers/tencent-provider.test.ts`
Expected: PASS。

Run: `npm test`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/electron/services/providers/google-provider.ts src/electron/services/providers/tencent-provider.ts src/electron/services/providers/provider-registry.ts src/electron/services/providers/google-provider.test.ts src/electron/services/providers/tencent-provider.test.ts
git commit -m "feat(provider): add google and tencent adapters"
```

---

### Task 8: 扩展统一翻译服务到完整 provider 集合

**Files:**
- Modify: `src/electron/services/translation-provider-service.ts`
- Modify: `src/electron/services/translation-provider-service.test.ts`
- Modify: `src/electron/main.ts`

**Step 1: Write the failing test**

补充统一服务测试：

```ts
await expect(service.translateWithSettings({
  text: '',
  settings
})).rejects.toMatchObject({
  code: 'PROVIDER_CONFIG_ERROR'
});
```

以及：

```ts
expect(service.getAvailableProviders()).toEqual(
  expect.arrayContaining(['claude', 'deepseek', 'minimax', 'gemini', 'google', 'tencent', 'tongyi', 'custom', 'mock'])
);
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/translation-provider-service.test.ts`
Expected: FAIL。

**Step 3: Write minimal implementation**

完善统一服务：

- 用 `provider-registry` 注入全部 provider
- 根据 `activeProviderId` 解析当前配置
- 构造统一执行上下文
- 映射 provider 错误
- 暴露可枚举 provider 列表，供渲染层后续使用

如果 `main.ts` 当前已有 provider 依赖占位，改成使用新的统一服务。

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/translation-provider-service.test.ts`
Expected: PASS。

Run: `npm run typecheck`
Expected: FAIL，仍会有设置页旧字段问题。

**Step 5: Commit**

```bash
git add src/electron/services/translation-provider-service.ts src/electron/services/translation-provider-service.test.ts src/electron/main.ts
git commit -m "feat(provider): wire full provider service"
```

---

### Task 9: 用 frontend-design 重构设置页的 provider 工作台

**Files:**
- Create: `src/renderer/components/provider-tile.tsx`
- Create: `src/renderer/components/provider-config-panel.tsx`
- Create: `src/renderer/components/secret-field.tsx`
- Modify: `src/renderer/pages/settings-page.tsx`
- Modify: `src/renderer/app/styles.css`
- Modify: `src/renderer/app/App.tsx`
- Test: `src/renderer/pages/settings-page.test.tsx`
- Test: `src/renderer/components/provider-config-panel.test.tsx`

**Step 1: Write the failing test**

先写 UI 测试，覆盖关键行为：

```tsx
await user.click(screen.getByRole('button', { name: /Claude/i }));
expect(screen.getByLabelText('API Key')).toBeInTheDocument();
expect(screen.queryByLabelText('SecretId')).not.toBeInTheDocument();
```

```tsx
await user.click(screen.getByRole('button', { name: /腾讯/i }));
expect(screen.getByLabelText('SecretId')).toBeInTheDocument();
expect(screen.getByLabelText('SecretKey')).toBeInTheDocument();
```

```tsx
await user.click(screen.getByRole('button', { name: /Google/i }));
expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/pages/settings-page.test.tsx src/renderer/components/provider-config-panel.test.tsx`
Expected: FAIL。

**Step 3: Write minimal implementation**

按 `frontend-design` 的方向重构设置页：

- 保留浅色工具型设置中心
- 左侧导航拆出 `Provider`
- 在右侧新增 provider tiles 区
- 根据当前 `activeProviderId` 渲染配置卡
- 多行输入区承载 `systemPrompt` 和 `userPromptTemplate`
- 密钥字段默认遮罩，支持显隐切换

`provider-config-panel.tsx` 至少要覆盖：

- `claude`
- `deepseek`
- `minimax`
- `gemini`
- `google`
- `tencent`
- `tongyi`
- `custom`
- `mock`

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/pages/settings-page.test.tsx src/renderer/components/provider-config-panel.test.tsx`
Expected: PASS。

Run: `npm run typecheck`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/renderer/components/provider-tile.tsx src/renderer/components/provider-config-panel.tsx src/renderer/components/secret-field.tsx src/renderer/pages/settings-page.tsx src/renderer/app/styles.css src/renderer/app/App.tsx src/renderer/pages/settings-page.test.tsx src/renderer/components/provider-config-panel.test.tsx
git commit -m "feat(renderer): redesign provider settings workspace"
```

---

### Task 10: 端到端验证 provider 设置与构建

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Write the failing test**

本任务不新增代码测试，先准备完整验证清单。

**Step 2: Run verification to expose gaps**

Run: `npm test`
Expected: PASS，所有单元测试和组件测试通过。

Run: `npm run typecheck`
Expected: PASS。

Run: `npm run build`
Expected: PASS。

如果任一失败，回到对应任务补齐。

**Step 3: Write minimal implementation**

仅在需要时补充：

- `README.md` 中的 provider 配置说明
- `package.json` 中为调试新增最小脚本

不要引入额外依赖，除非测试或实现确实需要。

**Step 4: Run verification to confirm completion**

Run: `npm test`
Expected: PASS。

Run: `npm run typecheck`
Expected: PASS。

Run: `npm run build`
Expected: PASS。

**Step 5: Commit**

```bash
git add README.md package.json
git commit -m "docs: document multi-provider settings"
```

---

## Execution Notes

- 整个实现过程必须遵守 `@test-driven-development`
- 设置页改造必须遵守 `@frontend-design`
- 所有 provider 网络调用都必须留在主进程
- 渲染层不得直接依赖具体 provider 协议
- 不要编辑 `dist/`、`dist-electron/` 或 `node_modules/`
- 若在实现过程中发现补齐 `openai`、`moonshot`、`zhipu`、`groq`、`openrouter`、`baichuan`、`lingyi` 仅需少量注册与默认配置，可在单独任务中顺手补上，但不要阻塞指定 8 个 provider 的交付
