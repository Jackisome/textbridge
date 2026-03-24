# TextBridge 翻译加载指示器设计

## 概述

在用户按下快捷键触发翻译后，显示一个跟随光标的加载动画（转圈），直到翻译完成（回写成功自动消失，回写失败保持并转为结果通知），提供即时反馈以改善用户体验。

## 用户体验目标

- 快捷键按下 → 光标旁立即显示转圈动画
- 翻译/回写成功 → 转圈自动消失
- 回写失败 → 转圈保持，转为结果通知
- 30 秒超时保护 → 超时后自动消失并提示

## 技术方案

### 渲染层选择

**方案：** 独立透明 Overlay 窗口 (BrowserWindow)

**理由：**
- 独立于主窗口，不影响目标应用交互
- `alwaysOnTop` 确保始终可见
- `transparent` 实现无背景仅动画效果
- 通过 IPC 与主进程通信控制显示/隐藏

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
- 翻译流程期间，每 100ms 更新一次位置（跟随光标）
- 翻译完成后停止更新并隐藏

## 组件架构

```
src/
├── electron/
│   ├── services/
│   │   ├── loading-overlay-service.ts      # 主服务，管理窗口生命周期
│   │   └── loading-overlay-window.ts       # BrowserWindow 创建逻辑
│   └── main.ts                             # 集成 loadingOverlayService
├── renderer/
│   ├── components/
│   │   └── LoadingOverlay.tsx              # React 转圈组件
│   └── pages/
│       └── loading-overlay-page.tsx         # 页面入口，渲染 LoadingOverlay
└── web/
    └── loading-overlay.html                 # Overlay 窗口 HTML 入口
```

### IPC 通道

| 通道 | 方向 | 说明 |
|------|------|------|
| `loading-overlay:show` | main → renderer | 显示 Overlay，传递初始光标位置 |
| `loading-overlay:hide` | main → renderer | 隐藏 Overlay |
| `loading-overlay:update-position` | main → renderer | 更新光标位置 |

## 实现逻辑

### 显示流程

```
ShortcutsService.onQuickTranslate()
    │
    ▼
loadingOverlayService.show()           // 1. 创建/显示 Overlay
    │
    ▼
QuickTranslationRunner.run()          // 2. 执行翻译流程
    │
    ├─► 成功 → loadingOverlayService.hide()
    │
    └─► 失败 → loadingOverlayService.showResult() → 通知 + 保持显示
```

### 位置跟随

```typescript
// 显示后启动位置跟踪
let trackingInterval = setInterval(() => {
  const pos = screen.getCursorScreenPoint();
  overlayWindow.setPosition(pos.x + 16, pos.y + 16);
}, 100);

// 隐藏时停止跟踪
clearInterval(trackingInterval);
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
  loadURL: (path) => mainWindow.webContents.loadURL(path),
});

// 在 ShortcutService 回调中使用
const shortcutService = createShortcutService({
  registrar: globalShortcut,
  handlers: {
    onQuickTranslate() {
      runWithReleasedMainWindow(() => {
        const pos = screen.getCursorScreenPoint();
        loadingOverlayService.show(pos);

        quickTranslationRunner.run().finally(() => {
          loadingOverlayService.hide();
        });
      });
    },
    // onContextTranslate 同理
  },
});
```

## 依赖

- Electron `BrowserWindow` API
- `screen.getCursorScreenPoint()` 获取光标位置
- IPC 通信控制渲染层

## 待定项

- [ ] 组件开发
- [ ] 单元测试
- [ ] 人工验证
