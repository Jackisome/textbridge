// @vitest-environment node

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockInstances: { close: ReturnType<typeof vi.fn>; show: ReturnType<typeof vi.fn> }[] = [];

// Use a function instead of arrow function for constructor compatibility
function createMockNotification() {
  const instance = {
    show: vi.fn(),
    close: vi.fn(),
    on: vi.fn()
  };
  mockInstances.push(instance);
  return instance;
}

const electronMock = vi.hoisted(() => {
  // Create a mock constructor by wrapping a function with vi.fn
  const MockNotificationConstructor = vi.fn(createMockNotification);
  return {
    Notification: MockNotificationConstructor
  };
});

vi.mock('electron', () => electronMock);

import { Win32NotificationService } from './notification-service';

describe('Win32NotificationService', () => {
  let service: Win32NotificationService;

  beforeEach(() => {
    service = new Win32NotificationService();
    mockInstances.length = 0;
    vi.clearAllMocks();
  });

  it('should show notification with correct title and body', () => {
    const config = {
      title: 'TextBridge',
      hint: '翻译完成',
      body: 'Hello World',
      autoCloseMs: 10000
    };

    service.show(config);

    expect(electronMock.Notification).toHaveBeenCalledWith({
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

    // First notification should have close called when second is shown
    expect(mockInstances[0].close).toHaveBeenCalled();
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

    expect(mockInstances[0].close).toHaveBeenCalled();
  });
});
