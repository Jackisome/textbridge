# TextBridge 翻译加载指示器设计

## 概述

在用户按下快捷键触发翻译后，在光标附近显示一个加载动画（转圈），翻译完成后自动消失，提供即时反馈以改善用户体验。

## 用户体验目标

- 快捷键按下 → 光标旁立即显示转圈动画
- 翻译完成（成功或失败）→ 转圈自动消失
- V1 暂不覆盖失败态通知和超时保护（见"待扩展项"）

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
    ├─► 完成 → loadingOverlayService.hide()
```

> V1：无论成功/失败，Overlay 均自动消失。暂不区分 UX。

### 位置跟随

显示时获取一次光标位置并设置窗口：

```typescript
const pos = screen.getCursorScreenPoint();
overlayWindow.setPosition(pos.x + 16, pos.y + 16);
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

        quickTranslationRunner.run().finally(() => {
          loadingOverlayService.hide();
          isActive = false;
        });
      });
    },
  },
});
```

## 并发控制

`isActive` 由 ShortcutService 回调层管理。若已激活，新请求被静默忽略。

## 依赖

- Electron `BrowserWindow` API
- `screen.getCursorScreenPoint()` 获取光标位置

## 待扩展项

以下功能在 V1 中暂不实现，作为后续迭代：

- [ ] **失败态通知**：回写失败时弹出系统通知，展示翻译结果或失败原因
- [ ] **超时保护**：30 秒超时后自动消失并提示，丢弃晚到的翻译结果
- [ ] **Context Translation 支持**：在用户提交 prompt 后显示 overlay
- [ ] **持续位置跟随**：翻译期间持续跟随光标位置

## 验收标准

1. 快捷键按下后，光标附近显示转圈动画
2. 翻译完成后（成功或失败），转圈自动消失
3. 快速连续按快捷键不会导致多个 overlay 重叠
4. Overlay 不会干扰目标应用的交互
