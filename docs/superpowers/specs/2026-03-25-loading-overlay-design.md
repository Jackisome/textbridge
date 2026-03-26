# TextBridge 翻译加载指示器设计

## 概述

在用户按下快捷键触发翻译后，在光标附近显示一个加载动画（转圈），翻译完成后自动消失，提供即时反馈以改善用户体验。

## 用户体验目标

- 快捷键按下 → 光标旁立即显示转圈动画
- 翻译完成（成功、失败、或 fallback-required）→ 转圈自动消失
  > fallback-required 时 runner 会通过 popup presenter 展示结果，overlay 在 `finally()` 中隐藏
- V1 覆盖 quick translation 和 context translation（增强翻译）
- V1 暂不覆盖失败态通知和超时保护

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
  frame: false,
  skipTaskbar: true,
  resizable: false,
  focusable: false,
  width: 40,
  height: 40,
}
```

### 点击穿透

Overlay 窗口需要点击穿透，不拦截鼠标事件：

```typescript
overlayWindow.setIgnoreMouseEvents(true, { forward: true });
```

### 窗口位置

- 使用 `screen.getCursorScreenPoint()` 获取光标位置
- 偏移量：+16, +16 像素（显示在光标右下角）
- 需做屏幕边缘裁剪，防止窗口超出屏幕

### 复用现有渲染器模式

Overlay 窗口复用项目已有的 `?view=xxx` 多视图模式：

```typescript
const url = new URL(baseUrl);
url.searchParams.set('view', 'loading-overlay');
overlayWindow.loadURL(url.toString());
```

## 组件架构

```
src/
├── electron/
│   ├── services/
│   │   ├── loading-overlay-service.ts      # 主服务，管理窗口生命周期（单例）
│   │   └── loading-overlay-window.ts       # BrowserWindow 创建逻辑
│   └── main.ts                             # 集成 loadingOverlayService
└── renderer/
    ├── components/
    │   └── LoadingOverlay.tsx              # React 转圈组件
    └── pages/
        └── LoadingOverlayPage.tsx           # 渲染 LoadingOverlay
```

**App.tsx 路由变更：** 在 `App.tsx` 中添加 `?view=loading-overlay` 的路由分支，渲染 `LoadingOverlayPage`。

## 设计原则

### 单例窗口

Overlay 使用单一 BrowserWindow 实例，预先创建（不销毁），通过 `show()` / `hide()` 控制显示隐藏。这确保：
- 首次触发无窗口创建延迟
- 无需 isActive 标志

### 并发策略

"进行中忽略新触发"：翻译进行中时，新的快捷键触发被静默忽略。ShortcutsService 回调持有 `isActive` 标志，在 `run().finally()` 回调中重置。第二次快捷键触发时若 `isActive === true`，则直接 return。

### 窗口预热

在 `App.on('ready')` 时预先创建 Overlay 窗口并隐藏。若创建失败，则按需创建（退化到按需模式）。

### 边缘裁剪

窗口位置需在 `screen.getDisplayNearestPoint()` 返回的 `workArea` 内，避免超出屏幕边界。

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
```

- 尺寸：24x24 像素
- 颜色：暗灰 `#666`
- 无背景，完全透明

## 集成点

在 `main.ts` 中初始化：

```typescript
import { createLoadingOverlayService } from './services/loading-overlay-service';

const loadingOverlayService = createLoadingOverlayService({
  preloadPath: path.join(__dirname, 'preload.js'),  // 与 main.ts 一致
  rendererUrl: process.env.VITE_DEV_SERVER_URL ?? `file://${path.join(__dirname, '../dist/index.html')}`,
});

// 窗口预热（在 ready 时）
app.whenReady().then(() => {
  loadingOverlayService.prepare();
});

// ShortcutService 中使用
const shortcutService = createShortcutService({
  handlers: {
    onQuickTranslate() {
      // 获取光标位置，显示 overlay
      const pos = screen.getCursorScreenPoint();
      loadingOverlayService.showAt(pos.x, pos.y);

      quickTranslationRunner.run().finally(() => {
        loadingOverlayService.hide();
      });
    },
  },
});
```

> 具体集成方式由 implementation plan 确定，此处仅为架构示意。

## 待扩展项

- [ ] **失败态通知**：回写失败时弹出系统通知
- [ ] **超时保护**：30 秒超时后自动消失
- [ ] **持续位置跟随**：翻译期间跟随光标

## 验收标准

1. 快捷键按下后，光标附近显示转圈动画
2. 翻译完成后（成功或失败），转圈自动消失
3. Overlay 不会干扰目标应用的鼠标交互
4. 窗口不会超出屏幕边界
