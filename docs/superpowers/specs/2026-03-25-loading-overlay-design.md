# TextBridge 翻译加载指示器设计

## 概述

在用户按下快捷键触发翻译后，显示一个跟随光标的加载动画（转圈），直到翻译完成（回写成功自动消失，回写失败则 Overlay 保持并弹出系统通知），提供即时反馈以改善用户体验。

## 用户体验目标

- 快捷键按下 → 光标旁立即显示转圈动画
- 翻译/回写成功 → 转圈自动消失（无通知）
- 回写失败 → Overlay 保持，同时弹出系统通知展示翻译结果
- 30 秒超时保护 → 超时后自动消失并弹出超时提示，底层翻译请求继续执行但结果不展示

## 技术方案

### 渲染层选择

**方案：** 独立透明 Overlay 窗口 (BrowserWindow)

**理由：**
- 独立于主窗口，不影响目标应用交互
- `alwaysOnTop` 确保始终可见
- `transparent` 实现无背景仅动画效果

### 窗口属性

```typescript
{
  transparent: true,
  alwaysOnTop: true,
  frame: false,           // 无边框
  skipTaskbar: true,      // 不显示在任务栏
  resizable: false,
  focusable: false,       // 不可聚焦，不拦截输入
  width: 40,
  height: 40,
}
```

### 窗口位置

- 使用 `screen.getCursorScreenPoint()` 获取光标位置
- 偏移量：+16, +16 像素（显示在光标右下角）
- 仅在 `show()` 时设置一次位置，翻译期间不持续跟踪
- 翻译完成后隐藏

### 复用现有渲染器模式

Overlay 窗口复用项目已有的 `?view=xxx` 多视图模式，而非引入新的 HTML 入口：

```typescript
// 创建 Overlay 窗口 URL
const url = new URL(baseUrl);
url.searchParams.set('view', 'loading-overlay');
overlayWindow.loadURL(url.toString());
```

这与 `ContextPromptWindowService` 的实现模式一致。

## 组件架构

```
src/
├── electron/
│   ├── services/
│   │   ├── loading-overlay-service.ts      # 主服务，管理窗口生命周期
│   │   └── loading-overlay-window.ts       # BrowserWindow 创建逻辑
│   └── main.ts                             # 集成 loadingOverlayService
└── renderer/
    ├── components/
    │   └── LoadingOverlay.tsx              # React 转圈组件
    └── pages/
        └── LoadingOverlayPage.tsx           # 渲染 LoadingOverlay，入口为 ?view=loading-overlay
```

**App.tsx 路由变更：** 在 `App.tsx` 中添加 `?view=loading-overlay` 的路由分支，渲染 `LoadingOverlayPage`。

> 复用 `index.html` 和 preload，无需新增 HTML 入口文件。

### IPC 通道

| 通道 | 方向 | 说明 |
|------|------|------|
| `loading-overlay:show` | main → renderer | 显示 Overlay |
| `loading-overlay:hide` | main → renderer | 隐藏 Overlay（恢复态） |
| `loading-overlay:keep-visible` | main → renderer | 保持显示（失败态） |

> 位置更新由主进程直接通过 `overlayWindow.setPosition()` 完成，无需 IPC。

## 实现逻辑

### 显示流程

```
ShortcutsService.onQuickTranslate()
    │
    ▼
loadingOverlayService.show()           // 1. 检查 isActive，若已激活则直接返回
    │
    ▼
QuickTranslationRunner.run()           // 2. 执行翻译流程
    │
    ├─► 成功 → loadingOverlayService.hide()           // 转圈消失，无通知
    │
    └─► 失败 → loadingOverlayService.keepVisible()     // Overlay 保持
              + notificationService.show()             // 弹出系统通知
```

**Context Translation 暂不覆盖：**
- Context flow 在用户提交 prompt 后才触发翻译，overlay 时机不同
- 初次实现仅覆盖 quick translation

### 位置跟随

显示时获取一次光标位置并设置窗口，后续不持续跟踪（YAGNI）：

```typescript
// 显示时设置一次位置
const pos = screen.getCursorScreenPoint();
overlayWindow.setPosition(pos.x + 16, pos.y + 16);
```

### 超时保护

```typescript
const TIMEOUT_MS = 30000;

let timeoutTimer = setTimeout(() => {
  loadingOverlayService.hide();
  notificationService.show({
    title: 'TextBridge',
    body: '翻译超时，请重试',
  });
  // 底层翻译请求继续执行，但结果不展示
}, TIMEOUT_MS);

// 翻译完成时清除 timer
clearTimeout(timeoutTimer);
```

## 外观

### CSS Spinner

```css
.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(100, 100, 100, 0.2);
  border-top-color: #666;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- 尺寸：24x24 像素
- 颜色：暗灰 `#666`，浅色环境适配
- 无背景，完全透明

## 主进程集成

在 `main.ts` 中：

```typescript
import { createLoadingOverlayService } from './services/loading-overlay-service';

// 创建服务
const loadingOverlayService = createLoadingOverlayService({
  rendererDevUrl: process.env.VITE_DEV_SERVER_URL,
  rendererProdHtml: path.join(__dirname, '../../dist/index.html'),
  preloadPath: path.join(__dirname, '../../dist-electron/preload.js'),
});

let isActive = false;

// 在 ShortcutService 回调中使用
const shortcutService = createShortcutService({
  registrar: globalShortcut,
  handlers: {
    onQuickTranslate() {
      if (isActive) return;
      isActive = true;

      runWithReleasedMainWindow(() => {
        loadingOverlayService.show();

        quickTranslationRunner.run().finally(() => {
          isActive = false;
        });
      });
    },
    // Context translation 暂不覆盖
  },
});
```

**Runner 结果处理：**
- QuickTranslationRunner 返回 `{ success: true }` 时 → `loadingOverlayService.hide()`
- 返回 `{ success: false, reason: 'write-back-failed' }` 时 → `loadingOverlayService.keepVisible()` + notification

## 并发控制

翻译请求串行执行：第二次快捷键触发时若已有活跃请求，则**忽略该次请求**（静默）。

```typescript
let isActive = false;

function onQuickTranslate() {
  if (isActive) return; // 忽略重复请求
  isActive = true;

  loadingOverlayService.show();
  quickTranslationRunner.run().finally(() => {
    // 成功 → hide()；失败 → keepVisible()
    isActive = false;
  });
}
```

`isActive` 由 ShortcutService 回调层管理，不放入 `loadingOverlayService`。`loadingOverlayService` 仅负责窗口生命周期。

## 依赖

- Electron `BrowserWindow` API
- `screen.getCursorScreenPoint()` 获取光标位置
- IPC 通信控制渲染层
- `NotificationService` 翻译结果/超时通知
