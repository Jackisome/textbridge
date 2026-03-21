import { Notification } from 'electron';
import type { INotificationService, NotificationConfig } from '../../../shared/types/notification';

export class Win32NotificationService implements INotificationService {
  private notification: Notification | null = null;
  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

  show(config: NotificationConfig): void {
    this.close();

    try {
      this.notification = new Notification({
        title: config.title,
        body: `${config.hint}\n\n${config.body}`,
        silent: false,
      });

      // Listen for errors to catch silent failures
      this.notification.on('failed', (event, error) => {
        console.error('[Win32NotificationService] Notification failed:', error);
      });

      this.notification.show();

      this.autoCloseTimer = setTimeout(() => {
        this.close();
      }, config.autoCloseMs);
    } catch (error) {
      console.error('[Win32NotificationService] Failed to show notification:', error);
    }
  }

  close(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
    if (this.notification) {
      try {
        this.notification.close();
      } catch (error) {
        console.error('[Win32NotificationService] Failed to close notification:', error);
      }
      this.notification = null;
    }
  }
}
