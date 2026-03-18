# Fallback Toast Notification Design

**Date:** 2026-03-19
**Status:** Approved
**Feature:** Fallback notification toast for translation results

## 1. Overview

When text capture succeeds but write-back fails (e.g., user clicks elsewhere and loses focus), the translation result is already copied to clipboard. This feature adds an OS-native toast notification to inform the user that the translation is complete and available.

The notification is implemented as an **OS-native toast** (not an in-app UI component), so it works even when the TextBridge window is minimized or hidden.

## 2. Goals

- Notify user of translation completion when write-back fails
- Display hint ("already copied to clipboard") and translated text
- Auto-dismiss after 10 seconds with a close button
- Work even when TextBridge app is minimized/hidden
- Platform-agnostic interface for future macOS/Linux support

## 3. Non-Goals

- In-app toast UI (BrowserWindow-based)
- Click-to-focus behavior (click does nothing)
- Custom styling beyond OS toast capabilities

## 4. Technical Design

### 4.1 Interface Definition

```typescript
// src/shared/types/notification.ts

export interface NotificationConfig {
  title: string;      // Toast title (e.g., "TextBridge")
  hint: string;       // Hint text (e.g., "翻译结果已复制到剪切板")
  body: string;       // Translated text content
  autoCloseMs: number; // Auto-close timeout in milliseconds (default: 10000)
}

export interface INotificationService {
  show(config: NotificationConfig): void;
  close(): void;
}
```

### 4.2 Platform Implementations

| Platform | File | Status |
|----------|------|--------|
| Windows | `src/electron/platform/win32/notification-service.ts` | To implement |
| macOS | `src/electron/platform/darwin/notification-service.ts` | Stub (code same as Win32) |
| Linux | `src/electron/platform/linux/notification-service.ts` | Stub (code same as Win32) |

### 4.3 Windows Implementation

Uses Electron's `Notification` API, which creates Windows Toast Notifications:

```typescript
// src/electron/platform/win32/notification-service.ts

export class Win32NotificationService implements INotificationService {
  private notification: Electron.Notification | null = null;
  private autoCloseTimer: NodeJS.Timeout | null = null;

  show(config: NotificationConfig): void {
    this.close(); // Close any existing notification

    this.notification = new Electron.Notification({
      title: config.title,
      body: `${config.hint}\n\n${config.body}`,
      silent: false, // Play system notification sound
    });

    this.notification.show();

    // Auto-close after configured timeout
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

### 4.4 Factory Function

```typescript
// src/electron/platform/notification-factory.ts

import { INotificationService } from '../../shared/types/notification';
import { Win32NotificationService } from './win32/notification-service';

export function createNotificationService(): INotificationService {
  switch (process.platform) {
    case 'win32':
      return new Win32NotificationService();
    case 'darwin':
      // TODO: Implement or use shared
      return new Win32NotificationService();
    case 'linux':
      // TODO: Implement or use shared
      return new Win32NotificationService();
    default:
      return new NoopNotificationService(); // Graceful fallback
  }
}
```

### 4.5 Integration Points

**File:** `src/electron/services/quick-translation-runner.ts`

In the fallback branch (around line 161-180):

```typescript
if (writeBackResult.method === 'popup-fallback') {
  // Copy to clipboard (already exists)
  await systemInteractionService.copyToClipboard(translationResult.translatedText);

  // Show notification if enabled
  const settings = await configService.getSettings();
  if (settings.enablePopupFallback) {
    const notificationService = createNotificationService();
    notificationService.show({
      title: 'TextBridge',
      hint: '翻译结果已复制到剪切板',
      body: translationResult.translatedText,
      autoCloseMs: 10000,
    });
  }

  return fallbackReport;
}
```

Same pattern applies to `context-translation-runner.ts`.

## 5. User-Facing Behavior

| Scenario | Behavior |
|----------|----------|
| Write-back fails, fallback triggered | Toast appears at bottom-right with hint + translation |
| User clicks close button | Toast dismisses immediately |
| 10 seconds elapse | Toast auto-closes |
| User clicks toast body | No action |
| Multiple translations triggered | New toast replaces previous |

## 6. OS-Specific Notes

### Windows
- Toast appears in bottom-right notification area
- Respects system notification settings (sound, do-not-disturb)
- Default timeout handled by Windows Action Center

### macOS
- Toast appears in top-right notification center
- Same Electron Notification API, no code change needed

### Linux
- Depends on notification daemon (notify-osd, notification-daemon)
- Same Electron Notification API, no code change needed

## 7. Settings

Add to `TranslationClientSettings`:

```typescript
export interface TranslationClientSettings {
  // ... existing fields
  enablePopupFallback: boolean; // default: true
}
```

## 8. Files to Create/Modify

### New Files
- `src/shared/types/notification.ts` - Interface definitions
- `src/electron/platform/win32/notification-service.ts` - Windows implementation
- `src/electron/platform/notification-factory.ts` - Factory function

### Modified Files
- `src/electron/services/quick-translation-runner.ts` - Add notification call in fallback branch
- `src/electron/services/context-translation-runner.ts` - Same addition
- `src/shared/types/settings.ts` - Add `enablePopupFallback` setting

### Stub Files (for future)
- `src/electron/platform/darwin/notification-service.ts`
- `src/electron/platform/linux/notification-service.ts`

## 9. Testing Considerations

- Unit test `Win32NotificationService` with mocked `Electron.Notification`
- Integration test: trigger fallback, verify toast appears
- Verify toast appears even when TextBridge window is minimized
