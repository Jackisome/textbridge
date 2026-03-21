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
