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
