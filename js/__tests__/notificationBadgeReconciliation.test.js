/* @flow */
'use strict';

import Site from '../site';
import SiteManager from '../site_manager';

jest.mock('@react-native-community/push-notification-ios', () => ({
  checkPermissions: jest.fn(),
  setApplicationIconBadgeNumber: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('react-native-device-info', () => ({
  getDeviceName: jest.fn().mockResolvedValue('Synthetic Device'),
}));
jest.mock('react-native-key-pair', () => ({}));
jest.mock('@react-native-cookies/cookies', () => ({ clearAll: jest.fn() }));
jest.mock('../memberContentAvailability', () => ({
  availableNotificationRows: jest.fn(rows => Promise.resolve(rows)),
}));

describe('notification badge reconciliation', () => {
  test('the New collection contains every actionable unread notification', async () => {
    const site = new Site({
      authToken: 'synthetic-token',
      url: 'https://adjusternetwork.org',
      unreadNotifications: 1,
    });
    site._notifications = [
      { id: 40, read: false, notification_type: 1 },
      { id: 39, read: true, notification_type: 1 },
    ];

    await expect(
      site.notifications(undefined, {
        onlyUnread: true,
        minId: 40,
        silent: true,
      }),
    ).resolves.toEqual([{ id: 40, read: false, notification_type: 1 }]);
  });

  test('bell count excludes counters not represented by Notifications New', () => {
    const manager = Object.create(SiteManager.prototype);
    manager.sites = [
      {
        authToken: 'synthetic-token',
        unreadNotifications: 1,
        unreadPrivateMessages: 3,
        chatNotifications: 4,
        flagCount: 5,
      },
    ];

    expect(manager.totalUnread()).toBe(1);
  });

  test('an empty actionable New result clears stale notification counters', async () => {
    const manager = Object.create(SiteManager.prototype);
    const site = {
      authToken: 'synthetic-token',
      unreadNotifications: 1,
      notifications: jest.fn().mockResolvedValue([]),
    };
    manager.sites = [site];
    manager.save = jest.fn();
    manager._onChange = jest.fn();
    manager.updateUnreadBadge = jest.fn();

    await expect(
      manager.notifications(undefined, { onlyNew: true, newMap: {} }),
    ).resolves.toEqual([]);

    expect(site.notifications).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ onlyUnread: true }),
    );
    expect(site.unreadNotifications).toBe(0);
    expect(manager.updateUnreadBadge).toHaveBeenCalledTimes(1);
  });
});
