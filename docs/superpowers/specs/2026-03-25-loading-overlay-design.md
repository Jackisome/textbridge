# TextBridge 翻译加载指示器设计

## 概述

在用户按下快捷键触发翻译后，在光标附近显示一个加载动画（转圈），直到翻译完成（回写成功自动消失，回写失败则 Overlay 保持并弹出系统通知），提供即时反馈以改善用户体验。

## 用户体验目标

- 快捷键按下 → 光标旁立即显示转圈动画
- 翻译/回写成功 → 转圈自动消失（无通知）
- 回写失败 → Overlay 保持，同时弹出系统通知；Overlay 在通知显示后自动隐藏（~5 秒）
- 30 秒超时保护 → 超时后 Overlay 消失并弹出超时提示；超时后底层翻译请求的所有副作用（写回、通知、剪贴板复制）均被丢弃

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
- 仅在 `show()` 时设置一次位置，翻译期间固定不动

### 复用现有渲染器模式

Overlay 窗口复用项目已有的 `?view=xxx` 多视图模式，而非引入新的 HTML 入口：

```typescript
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

无需 IPC。主进程通过 `overlayWindow.show()` / `overlayWindow.hide()` 直接控制窗口显示隐藏。渲染层通过 CSS 类 `.visible` / `.failure-visible` 控制 spinner 样式（成功态/失败态）。

> 位置由主进程直接通过 `overlayWindow.setPosition()` 设置，无需 IPC。

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
    ├─► completed → loadingOverlayService.hide()
    │
    └─► failed / fallback-required → loadingOverlayService.showFailure()
              + notificationService.show()
```

**Context Translation 暂不覆盖：** 初次实现仅覆盖 quick translation。

### 位置跟随

显示时获取一次光标位置并设置窗口，翻译期间固定不动：

```typescript
const pos = screen.getCursorScreenPoint();
overlayWindow.setPosition(pos.x + 16, pos.y + 16);
```

### 超时保护

```typescript
const TIMEOUT_MS = 30000;
let timeoutTimer: ReturnType<typeof setTimeout>;

function startTimeout() {
  timeoutTimer = setTimeout(() => {
    loadingOverlayService.hide();
    notificationService.show({ title: 'TextBridge', body: '翻译超时，请重试' });
    // 超时后丢弃所有晚到的翻译结果副作用
  }, TIMEOUT_MS);
}

function clearTimeoutAndRun(runner, onDone) {
  runner.run().finally(() => {
    clearTimeout(timeoutTimer);
    onDone();
  });
}
```

**超时后行为：** 底层翻译请求继续执行，但其副作用（写回目标应用、系统通知、剪贴板复制）均被丢弃。

### 失败态生命周期

回写失败时：
1. Overlay 保持显示（添加 `.failure-visible` 类使 spinner 可见）
2. 系统通知弹出
3. 5 秒后 Overlay 自动隐藏

## 主进程集成

```typescript
import { createLoadingOverlayService } from './services/loading-overlay-service';

const loadingOverlayService = createLoadingOverlayService({
  rendererDevUrl: process.env.VITE_DEV_SERVER_URL,
  rendererProdHtml: path.join(__dirname, '../../dist/index.html'),
  preloadPath: path.join(__dirname, '../../dist-electron/preload.js'),
});

let isActive = false;

const shortcutService = createShortcutService({
  registrar: globalShortcut,
  handlers: {
    onQuickTranslate() {
      if (isActive) return;  // 忽略重复请求
      isActive = true;

      runWithReleasedMainWindow(() => {
        loadingOverlayService.show();
        startTimeout();

        quickTranslationRunner.run().finally(() => {
          clearTimeout(timeoutTimer);
          isActive = false;
        });
      });
    },
  },
});
```

**Runner 结果处理（基于 ExecutionReport）：**
- `report.status === 'completed'` → `loadingOverlayService.hide()`
- `report.status === 'failed' | 'fallback-required'` → `loadingOverlayService.showFailure()` + notification

> `showFailure()` 显示失败态 spinner（通过 CSS 类），5 秒后自动 hide()。

## 并发控制

`isActive` 由 ShortcutService 回调层管理。若已激活，新请求被静默忽略。

## 依赖

- Electron `BrowserWindow` API
- `screen.getCursorScreenPoint()` 获取光标位置
- `NotificationService` 翻译结果/超时通知
