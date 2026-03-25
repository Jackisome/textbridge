# Loading Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 quick translation 流程增加一个透明、点击穿透、可预热复用的 loading overlay 窗口，在用户按下快捷键后立即显示在光标附近，并在翻译结束的所有退出路径中自动消失。

**Architecture:** 将实现拆成两个 Electron 层单元和两个 Renderer 层单元。Electron 侧由一个纯窗口工厂负责 BrowserWindow 选项、`?view=loading-overlay` URL 与边界裁剪，再由单例服务负责预热、复用、显示、隐藏和故障重建；Renderer 侧通过独立的 `?view=loading-overlay` 路由渲染一个最小化 spinner 页面，并显式覆盖当前全局背景样式，确保透明窗口不会被 `:root` 的渐变背景填满。`main.ts` 只负责把该服务接到 quick translation 快捷键生命周期上，并在执行中忽略新的 quick translation 触发。

**Tech Stack:** Electron 40 BrowserWindow/screen API, React 19, TypeScript 5.9, Vite multi-view renderer, Vitest 4, Testing Library, existing `src/renderer/app/styles.css`.

---

## File Map

- Create: `src/electron/services/loading-overlay-window.ts`
  Responsibility: 纯 helper，负责 overlay 的 BrowserWindow 选项、`?view=loading-overlay` URL、以及基于光标与 `workArea` 的 40x40 边界裁剪。不要放单例状态。
- Create: `src/electron/services/loading-overlay-window.test.ts`
  Responsibility: 锁定透明窗口配置、点击穿透调用、URL 生成和屏幕边缘裁剪。
- Create: `src/electron/services/loading-overlay-service.ts`
  Responsibility: 管理单例窗口生命周期，提供 `prepare()`, `showAt(x, y)`, `hide()`, `dispose()`, `getWindow()`；内部支持预热失败后的按需重建。
- Create: `src/electron/services/loading-overlay-service.test.ts`
  Responsibility: 验证预热只创建一次、`showAt()` 复用同一实例、`hide()` 不销毁窗口、以及失败后可恢复。
- Create: `src/renderer/components/LoadingOverlay.tsx`
  Responsibility: 纯展示 spinner，本身不做路由和 DOM 全局副作用。
- Create: `src/renderer/components/LoadingOverlay.test.tsx`
  Responsibility: 验证可访问状态标记与最小 DOM 结构。
- Create: `src/renderer/pages/LoadingOverlayPage.tsx`
  Responsibility: 组合 `LoadingOverlay`，并在挂载时给 `document.documentElement` / `document.body` 打上 `data-view="loading-overlay"` 标记，卸载时清理，供全局 CSS 切换到透明模式。
- Create: `src/renderer/pages/LoadingOverlayPage.test.tsx`
  Responsibility: 验证页面挂载/卸载时的数据属性生命周期，以及 spinner 是否被渲染。
- Modify: `src/renderer/app/App.tsx`
  Responsibility: 增加 `?view=loading-overlay` 路由分支，并确保该路由不触发 settings bootstrap。
- Modify: `src/renderer/app/App.test.tsx`
  Responsibility: 验证 loading overlay route 只渲染 overlay 页面，不读取设置、不读取 runtime status。
- Modify: `src/renderer/app/styles.css`
  Responsibility: 新增 overlay page 和 spinner 样式，并覆盖当前 `:root` / `body` / `#root` 背景，让透明 BrowserWindow 真正只显示转圈动画。
- Modify: `src/electron/main.ts`
  Responsibility: 创建 `loadingOverlayService`，在 `app.whenReady()` 中预热，在 quick translation 执行前立刻显示 overlay，并在 `finally()` 中隐藏；新增 quick translation 进行中忽略重入的保护。
- Create: `src/electron/main.test.ts`
  Responsibility: 用模块 mock 验证 ready 时会预热 overlay，以及 quick translation 触发时 overlay 的 show/hide 与重入保护。

## Assumptions

- 按用户要求，新增 renderer 文件使用精确路径 `src/renderer/components/LoadingOverlay.tsx` 和 `src/renderer/pages/LoadingOverlayPage.tsx`，即使仓库现有多数 renderer 文件使用 kebab-case 命名。
- `src/renderer/app/main.tsx` 当前只导入 `src/renderer/app/styles.css`，因此 overlay 的样式也应继续落在该文件。
- 透明窗口不仅需要 `BrowserWindow({ transparent: true })`，还必须覆盖当前 `:root` 的渐变背景，否则 overlay 会显示成完整背景面板而不是仅显示 spinner。

### Task 1: Build the loading overlay window factory

**Files:**
- Create: `src/electron/services/loading-overlay-window.ts`
- Test: `src/electron/services/loading-overlay-window.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createLoadingOverlayBrowserWindow,
  resolveLoadingOverlayWindowBounds,
  toLoadingOverlayUrl
} from './loading-overlay-window';

describe('loading overlay window helpers', () => {
  it('creates a transparent click-through overlay window', () => {
    const setIgnoreMouseEvents = vi.fn();
    const browserWindowFactory = vi.fn().mockReturnValue({
      setIgnoreMouseEvents,
      on: vi.fn()
    });

    createLoadingOverlayBrowserWindow({
      browserWindowFactory,
      preloadPath: 'C:/tmp/preload.js'
    });

    expect(browserWindowFactory).toHaveBeenCalledWith(expect.objectContaining({
      width: 40,
      height: 40,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: false,
      show: false
    }));
    expect(setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
  });

  it('builds the loading-overlay URL for both dev and packaged modes', () => {
    expect(toLoadingOverlayUrl('http://127.0.0.1:5173/', undefined)).toContain('view=loading-overlay');
    expect(toLoadingOverlayUrl('file:///C:/app/dist/index.html', 'file:///C:/app/dist/index.html'))
      .toContain('view=loading-overlay');
  });

  it('clamps bounds near the screen edge', () => {
    expect(
      resolveLoadingOverlayWindowBounds({
        cursorPoint: { x: 1915, y: 1075 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
      })
    ).toEqual({ x: 1880, y: 1040, width: 40, height: 40 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/loading-overlay-window.test.ts`
Expected: FAIL because `src/electron/services/loading-overlay-window.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export const LOADING_OVERLAY_WINDOW_SIZE = { width: 40, height: 40 };

export function resolveLoadingOverlayWindowBounds(...) {
  // cursor + 16px offset, then clamp into display workArea
}

export function toLoadingOverlayUrl(...) {
  const url = new URL(baseUrl);
  url.searchParams.set('view', 'loading-overlay');
  return url.toString();
}

export function createLoadingOverlayBrowserWindow(...) {
  const win = browserWindowFactory({
    ...LOADING_OVERLAY_WINDOW_SIZE,
    transparent: true,
    alwaysOnTop: true,
    frame: false,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.setIgnoreMouseEvents(true, { forward: true });
  return win;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/loading-overlay-window.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/electron/services/loading-overlay-window.ts src/electron/services/loading-overlay-window.test.ts
git commit -m "feat: add loading overlay window factory"
```

### Task 2: Add the singleton loading overlay service

**Files:**
- Create: `src/electron/services/loading-overlay-service.ts`
- Test: `src/electron/services/loading-overlay-service.test.ts`
- Use: `src/electron/services/loading-overlay-window.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createLoadingOverlayService } from './loading-overlay-service';

describe('createLoadingOverlayService', () => {
  it('prepares once and reuses the same hidden window for show/hide', async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const setBounds = vi.fn();
    const show = vi.fn();
    const hide = vi.fn();
    const isDestroyed = vi.fn().mockReturnValue(false);
    const createWindow = vi.fn().mockReturnValue({
      loadURL,
      setBounds,
      show,
      hide,
      isDestroyed,
      on: vi.fn()
    });

    const service = createLoadingOverlayService({
      createWindow,
      rendererDevUrl: 'http://127.0.0.1:5173/',
      rendererProdHtml: undefined,
      getDisplayNearestPoint: () => ({
        workArea: { x: 0, y: 0, width: 1280, height: 720 }
      })
    });

    await service.prepare();
    await service.showAt(1268, 708);
    service.hide();

    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(loadURL).toHaveBeenCalledTimes(1);
    expect(setBounds).toHaveBeenCalledWith({ x: 1240, y: 680, width: 40, height: 40 });
    expect(show).toHaveBeenCalledTimes(1);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('drops a broken window after load failure so a later showAt can recreate it', async () => {
    // first createWindow() returns a broken instance; second returns a healthy one
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/loading-overlay-service.test.ts`
Expected: FAIL because the service module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface LoadingOverlayService {
  prepare(): Promise<void>;
  showAt(x: number, y: number): Promise<void>;
  hide(): void;
  dispose(): void;
  getWindow(): BrowserWindow | null;
}

export function createLoadingOverlayService(...) {
  let activeWindow: BrowserWindow | null = null;
  let loadPromise: Promise<void> | null = null;

  async function ensureWindowLoaded(): Promise<BrowserWindow> {
    // create once, load renderer once, reset on failure
  }

  return {
    async prepare() {
      await ensureWindowLoaded().catch(() => undefined);
    },
    async showAt(x, y) {
      const win = await ensureWindowLoaded();
      const { workArea } = getDisplayNearestPoint({ x, y });
      win.setBounds(resolveLoadingOverlayWindowBounds({ cursorPoint: { x, y }, workArea }));
      win.show();
    },
    hide() {
      activeWindow?.hide();
    },
    dispose() {
      activeWindow?.destroy?.();
      activeWindow = null;
      loadPromise = null;
    },
    getWindow() {
      return activeWindow;
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/loading-overlay-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/electron/services/loading-overlay-service.ts src/electron/services/loading-overlay-service.test.ts
git commit -m "feat: add loading overlay lifecycle service"
```

### Task 3: Add the renderer spinner component

**Files:**
- Create: `src/renderer/components/LoadingOverlay.tsx`
- Test: `src/renderer/components/LoadingOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingOverlay } from './LoadingOverlay';

describe('LoadingOverlay', () => {
  it('renders a non-interactive status spinner', () => {
    render(<LoadingOverlay />);

    expect(screen.getByRole('status', { name: '翻译中' })).not.toBeNull();
    expect(screen.getByTestId('loading-overlay-spinner')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/LoadingOverlay.test.tsx`
Expected: FAIL because `src/renderer/components/LoadingOverlay.tsx` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
export function LoadingOverlay() {
  return (
    <div className="loading-overlay" role="status" aria-label="翻译中" aria-live="polite">
      <div
        className="loading-overlay__spinner"
        data-testid="loading-overlay-spinner"
        aria-hidden="true"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/components/LoadingOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/LoadingOverlay.tsx src/renderer/components/LoadingOverlay.test.tsx
git commit -m "feat: add loading overlay renderer component"
```

### Task 4: Add the loading overlay page and transparent route styling

**Files:**
- Create: `src/renderer/pages/LoadingOverlayPage.tsx`
- Test: `src/renderer/pages/LoadingOverlayPage.test.tsx`
- Modify: `src/renderer/app/styles.css`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingOverlayPage } from './LoadingOverlayPage';

describe('LoadingOverlayPage', () => {
  it('marks the document as loading-overlay while mounted', () => {
    const { unmount } = render(<LoadingOverlayPage />);

    expect(document.documentElement.dataset.view).toBe('loading-overlay');
    expect(document.body.dataset.view).toBe('loading-overlay');
    expect(screen.getByRole('status', { name: '翻译中' })).not.toBeNull();

    unmount();

    expect(document.documentElement.dataset.view).not.toBe('loading-overlay');
    expect(document.body.dataset.view).not.toBe('loading-overlay');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/pages/LoadingOverlayPage.test.tsx`
Expected: FAIL because `src/renderer/pages/LoadingOverlayPage.tsx` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useEffect } from 'react';
import { LoadingOverlay } from '../components/LoadingOverlay';

export function LoadingOverlayPage() {
  useEffect(() => {
    document.documentElement.dataset.view = 'loading-overlay';
    document.body.dataset.view = 'loading-overlay';

    return () => {
      delete document.documentElement.dataset.view;
      delete document.body.dataset.view;
    };
  }, []);

  return (
    <main className="loading-overlay-page">
      <LoadingOverlay />
    </main>
  );
}
```

Add matching CSS in `src/renderer/app/styles.css`:

```css
:root[data-view='loading-overlay'],
body[data-view='loading-overlay'],
body[data-view='loading-overlay'] #root {
  background: transparent;
}

body[data-view='loading-overlay'] {
  min-width: 0;
  min-height: 100vh;
  overflow: hidden;
}

.loading-overlay-page {
  display: grid;
  place-items: center;
  min-height: 100vh;
  background: transparent;
  pointer-events: none;
}

.loading-overlay {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
}

.loading-overlay__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(100, 100, 100, 0.2);
  border-top-color: #666;
  border-radius: 50%;
  animation: loading-overlay-spin 0.8s linear infinite;
}

@keyframes loading-overlay-spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/pages/LoadingOverlayPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pages/LoadingOverlayPage.tsx src/renderer/pages/LoadingOverlayPage.test.tsx src/renderer/app/styles.css
git commit -m "feat: add loading overlay page styling"
```

### Task 5: Route the loading overlay through `App.tsx`

**Files:**
- Modify: `src/renderer/app/App.tsx`
- Modify: `src/renderer/app/App.test.tsx`
- Use: `src/renderer/pages/LoadingOverlayPage.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('does not bootstrap settings for the loading overlay route', () => {
  const getSettings = vi.fn().mockResolvedValue(createSettings());
  const getRuntimeStatus = vi.fn().mockResolvedValue({
    ready: true,
    platform: 'win32',
    activeProvider: 'mock',
    registeredShortcuts: [],
    helperState: 'idle',
    helperLastErrorCode: null,
    helperPid: null,
    lastExecution: null,
    recentExecutions: []
  });

  window.history.pushState({}, '', '/?view=loading-overlay');
  window.textBridge = {
    getSettings,
    saveSettings: vi.fn().mockResolvedValue(createSettings()),
    getRuntimeStatus,
    getContextPromptSession: vi.fn().mockResolvedValue(null),
    submitContextPrompt: vi.fn().mockResolvedValue(undefined),
    cancelContextPrompt: vi.fn().mockResolvedValue(undefined)
  };

  render(<App />);

  expect(screen.getByRole('status', { name: '翻译中' })).not.toBeNull();
  expect(getSettings).not.toHaveBeenCalled();
  expect(getRuntimeStatus).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/app/App.test.tsx --testNamePattern="loading overlay"`
Expected: FAIL because `App.tsx` does not yet route `view=loading-overlay`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { LoadingOverlayPage } from '../pages/LoadingOverlayPage';

function LoadingOverlayRoute() {
  return <LoadingOverlayPage />;
}

export default function App() {
  const view = new URLSearchParams(window.location.search).get('view');

  if (view === 'context-popup') {
    return <ContextPopupRoute />;
  }

  if (view === 'fallback-result') {
    return <FallbackResultRoute />;
  }

  if (view === 'loading-overlay') {
    return <LoadingOverlayRoute />;
  }

  return <SettingsRoute />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/app/App.test.tsx --testNamePattern="loading overlay"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/app/App.tsx src/renderer/app/App.test.tsx
git commit -m "feat: route loading overlay view"
```

### Task 6: Integrate the loading overlay service into quick translation

**Files:**
- Modify: `src/electron/main.ts`
- Create: `src/electron/services/loading-overlay-integration.test.ts`
- Use: `src/electron/services/loading-overlay-service.ts`

> **Note:** 直接测试 `main.ts` 不可行，因为 `main.ts` 在模块顶层有大量副作用（windowService、shortcutService、app.whenReady 链等）。改为测试 `shortcutService` 的 handler 是否正确调用 `loadingOverlayService.showAt()` / `hide()`。

- [ ] **Step 1: Write the failing test**

```ts
// src/electron/services/loading-overlay-integration.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

const prepare = vi.fn().mockResolvedValue(undefined);
const showAt = vi.fn().mockResolvedValue(undefined);
const hide = vi.fn();
const dispose = vi.fn();
const getWindow = vi.fn<() => BrowserWindow | null>(() => null);

vi.mock('./loading-overlay-service', () => ({
  createLoadingOverlayService: vi.fn(() => ({
    prepare,
    showAt,
    hide,
    dispose,
    getWindow
  }))
}));

describe('loading overlay integration with shortcut handler', () => {
  it('calls showAt before runner.run and hide in finally', async () => {
    const capturedHandlers: { onQuickTranslate: () => void } | null = null;
    const run = vi.fn().mockResolvedValue({ id: 'r1', status: 'completed' });

    vi.mock('./shortcut-service', () => ({
      createShortcutService: vi.fn(({ handlers }: { handlers: { onQuickTranslate: () => void } }) => {
        capturedHandlers = handlers;
        return {
          applySettings: vi.fn(),
          getRegisteredShortcuts: vi.fn(() => []),
          dispose: vi.fn()
        };
      })
    }));

    vi.mock('./quick-translation-runner', () => ({
      createQuickTranslationRunner: vi.fn(() => ({ run }))
    }));

    // Lazy-import to avoid top-level side effects before mocks are set
    await import('../main');

    // Simulate quick translate trigger
    capturedHandlers?.onQuickTranslate();
    await Promise.resolve(); // allow async showAt to settle

    expect(showAt).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
    expect(hide).toHaveBeenCalled();
  });
});
```

> 由于 `main.ts` 的副作用问题，更实用的方法是验证 `shortcutService` 在 `onQuickTranslate` 被调用时**最终**会触发 `loadingOverlayService.showAt/hide`。具体实现时，需要将 `loadingOverlayService` 作为依赖注入，而非在 `main.ts` 内直接创建。

**推荐实现方式：** 修改 `createShortcutService` 的选项类型，增加可选的 `loadingOverlayService` 依赖。在 `main.ts` 中传入该服务。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/electron/services/loading-overlay-integration.test.ts`
Expected: FAIL because the integration pattern does not exist yet.

- [ ] **Step 3: Write minimal implementation**

在 `main.ts` 中：

```ts
import { createLoadingOverlayService } from './services/loading-overlay-service';

const loadingOverlayService = createLoadingOverlayService({ ... });

let isActive = false;

// 在 onQuickTranslate handler 中
if (isActive) return;
isActive = true;

const pos = screen.getCursorScreenPoint();
void loadingOverlayService.showAt(pos.x, pos.y);

runner.run().finally(() => {
  loadingOverlayService.hide();
  isActive = false;
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/electron/services/loading-overlay-integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/electron/main.ts src/electron/services/loading-overlay-integration.test.ts
git commit -m "feat: show loading overlay during quick translation"
```

## Final Verification

- [ ] Run: `npm test`
  Expected: all Vitest suites pass, including the new loading overlay tests.
- [ ] Run: `npm run typecheck`
  Expected: both renderer and electron TypeScript checks pass.
- [ ] Run: `npm run build`
  Expected: Vite and Electron builds complete successfully with the new overlay route bundled.
- [ ] Run: `npm run dev`
  Expected: manual smoke test confirms:
  1. quick translation 快捷键按下后，光标右下角立即显示 spinner；
  2. success / failure / popup fallback 后 overlay 都会消失；
  3. overlay 不拦截鼠标；
  4. 光标靠近屏幕边缘时窗口仍被裁剪在 `workArea` 内。
