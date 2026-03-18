# Fallback Toast Notification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OS-native toast notification that shows when write-back fails and translation is copied to clipboard.

**Architecture:** Create `INotificationService` interface with platform-abstracted factory. Windows implementation uses Electron `Notification` API. Integration via `popupService.showFallbackResult()` in main.ts.

**Tech Stack:** TypeScript, Electron Notification API, Node.js

---

## Chunk 1: Interface and Platform Structure

### Files
- Create: `src/shared/types/notification.ts`
- Create: `src/electron/platform/win32/notification-service.ts`
- Create: `src/electron/platform/notification-factory.ts`

---

### Task 1: Create notification types interface

**Files:**
- Create: `src/shared/types/notification.ts`

- [ ] **Step 1: Create the notification types file**

```typescript
// src/shared/types/notification.ts

export interface NotificationConfig {
  title: string;
  hint: string;
  body: string;
  autoCloseMs: number;
}

export interface INotificationService {
  show(config: NotificationConfig): void;
  close(): void;
}
```

- [ ] **Step 2: Verify file creation**
Run: `ls src/shared/types/notification.ts`
Expected: File exists

---

### Task 2: Create Windows notification service implementation

**Files:**
- Create: `src/electron/platform/win32/notification-service.ts`

- [ ] **Step 1: Create the Windows notification service**

```typescript
// src/electron/platform/win32/notification-service.ts

import { ElectronNotification } from 'electron';
import type { INotificationService, NotificationConfig } from '../../../shared/types/notification';

export class Win32NotificationService implements INotificationService {
  private notification: Electron.Notification | null = null;
  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

  show(config: NotificationConfig): void {
    this.close();

    this.notification = new Electron.Notification({
      title: config.title,
      body: `${config.hint}\n\n${config.body}`,
      silent: false,
    });

    this.notification.show();

    this.autoCloseTimer = setTimeout(() => {
      this.close();
    }, config.autoCloseMs);
  }

  close(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
    this.notification?.close();
    this.notification = null;
  }
}
```

- [ ] **Step 2: Verify file creation**
Run: `ls src/electron/platform/win32/notification-service.ts`
Expected: File exists

---

### Task 3: Create notification factory

**Files:**
- Create: `src/electron/platform/notification-factory.ts`

- [ ] **Step 1: Create the notification factory**

```typescript
// src/electron/platform/notification-factory.ts

import type { INotificationService } from '../../shared/types/notification';
import { Win32NotificationService } from './win32/notification-service';

class NoopNotificationService implements INotificationService {
  show(): void {}
  close(): void {}
}

export function createNotificationService(): INotificationService {
  switch (process.platform) {
    case 'win32':
      return new Win32NotificationService();
    case 'darwin':
      // Electron Notification API works on macOS too
      return new Win32NotificationService();
    case 'linux':
      // Electron Notification API works on Linux too
      return new Win32NotificationService();
    default:
      return new NoopNotificationService();
  }
}
```

- [ ] **Step 2: Verify file creation**
Run: `ls src/electron/platform/notification-factory.ts`
Expected: File exists

---

## Chunk 2: Integration into main.ts

### Files
- Modify: `src/electron/main.ts` (around lines 111-113)

---

### Task 4: Integrate notification service into main.ts

**Files:**
- Modify: `src/electron/main.ts:111-113`

- [ ] **Step 1: Read current main.ts around showFallbackResult to understand import context**

Run: `head -20 src/electron/main.ts`
Expected: See imports from similar service files

- [ ] **Step 2: Add import for notification factory**

Add at top of main.ts (after existing imports):
```typescript
import { createNotificationService } from './platform/notification-factory';
```

- [ ] **Step 3: Modify showFallbackResult implementation**

Change from:
```typescript
async showFallbackResult() {
  await windowService.showMainWindow();
},
```

To:
```typescript
async showFallbackResult(payload) {
  const settings = await settingsService.getSettings();
  if (settings.enablePopupFallback) {
    const notificationService = createNotificationService();
    notificationService.show({
      title: 'TextBridge',
      hint: '翻译结果已复制到剪切板',
      body: payload.translatedText,
      autoCloseMs: 10000,
    });
  }
},
```

- [ ] **Step 4: Verify main.ts compiles**
Run: `npx tsc --noEmit src/electron/main.ts`
Expected: No errors (or only pre-existing errors)

---

## Chunk 3: Testing

### Files
- Create: `src/electron/platform/win32/notification-service.test.ts`

---

### Task 5: Write unit test for Win32NotificationService

**Files:**
- Create: `src/electron/platform/win32/notification-service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Electron.Notification before imports
vi.mock('electron', () => ({
  Notification: vi.fn().mockImplementation(() => ({
    show: vi.fn(),
    close: vi.fn(),
    on: vi.fn()
  }))
}));

import { Win32NotificationService } from './notification-service';

describe('Win32NotificationService', () => {
  let service: Win32NotificationService;

  beforeEach(() => {
    service = new Win32NotificationService();
  });

  it('should show notification with correct title and body', () => {
    const config = {
      title: 'TextBridge',
      hint: '翻译完成',
      body: 'Hello World',
      autoCloseMs: 10000
    };

    service.show(config);

    const NotificationConstructor = require('electron').Notification;
    expect(NotificationConstructor).toHaveBeenCalledWith({
      title: 'TextBridge',
      body: '翻译完成\n\nHello World',
      silent: false
    });
  });

  it('should close previous notification before showing new one', () => {
    const config = {
      title: 'TextBridge',
      hint: 'Test',
      body: 'Test body',
      autoCloseMs: 10000
    };

    service.show(config);
    service.show(config);

    const NotificationConstructor = require('electron').Notification;
    const mockInstance = NotificationConstructor.mock.results[1].value;
    expect(mockInstance.close).toHaveBeenCalled();
  });

  it('should close notification when close() is called', () => {
    const config = {
      title: 'TextBridge',
      hint: 'Test',
      body: 'Test body',
      autoCloseMs: 10000
    };

    service.show(config);
    service.close();

    const NotificationConstructor = require('electron').Notification;
    const mockInstance = NotificationConstructor.mock.results[0].value;
    expect(mockInstance.close).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/electron/platform/win32/notification-service.test.ts`
Expected: FAIL (function not implemented yet, but mock setup correct)

---

## Chunk 4: Final Verification

### Task 6: Verify integration and run existing tests

- [ ] **Step 1: Run TypeScript check on entire electron folder**
Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 2: Run existing tests to ensure no regressions**
Run: `npx vitest run src/electron/services/quick-translation-runner.test.ts`
Expected: PASS

- [ ] **Step 3: Commit changes**
Run:
```bash
git add src/shared/types/notification.ts src/electron/platform/win32/notification-service.ts src/electron/platform/notification-factory.ts src/electron/main.ts
git commit -m "feat: add OS-native fallback toast notification

- Add INotificationService interface in shared/types
- Win32NotificationService using Electron Notification API
- Factory for cross-platform notification service creation
- Integration in main.ts showFallbackResult handler

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
Expected: Commit created successfully

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/shared/types/notification.ts` | New - interface definitions |
| `src/electron/platform/win32/notification-service.ts` | New - Windows implementation |
| `src/electron/platform/notification-factory.ts` | New - factory function |
| `src/electron/main.ts` | Modified - showFallbackResult calls notification service |
| `src/electron/platform/win32/notification-service.test.ts` | New - unit tests |

## Notes

- `enablePopupFallback` already exists in `settings.ts` (line 18), no modification needed
- The `popupFallbackPresenter.showResult()` in quick-translation-runner.ts already calls `popupService.showFallbackResult()`, so the integration chain is already wired
- Windows Toast appearance (position, styling) is controlled by OS, not by our code
- Electron Notification API handles macOS and Linux identically, so stubs are just for interface completeness
