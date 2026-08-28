/* @flow */
'use strict';

import Site from '../site';
import SiteManager from '../site_manager';
import fs from 'fs';
import path from 'path';

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
  test('cold-launch metadata failure cannot suppress authenticated refresh', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'site_manager.js'),
      'utf8',
    );
    expect(source).toContain('Promise.allSettled(promises)');
    expect(source).toContain('this.refreshSites();');
  });
  test('a partial totals response cannot replace a valid notification count', async () => {
    const site = new Site({
      authToken: 'synthetic-token',
      url: 'https://adjusternetwork.org',
      unreadNotifications: 10,
    });
    site.jsonApi = jest.fn().mockResolvedValue({
      topic_tracking: { unread: 0, new: 0 },
      username: 'synthetic-user',
    });

    await site.refresh({ reason: 'foreground' });
    expect(site.unreadNotifications).toBe(10);
  });

  test('an explicit refresh bypasses a stale cached zero', async () => {
    const site = new Site({
      authToken: 'synthetic-token',
      url: 'https://adjusternetwork.org',
      unreadNotifications: 0,
    });
    site._notifications = [];
    site.jsonApi = jest.fn().mockResolvedValue({
      notifications: [{ id: 41, read: false, notification_type: 1 }],
    });

    await expect(
      site.notifications(undefined, { silent: false, surfaceErrors: true }),
    ).resolves.toHaveLength(1);
    expect(site.jsonApi).toHaveBeenCalledTimes(1);
  });

  test('concurrent list consumers share one settling API request', async () => {
    const site = new Site({
      authToken: 'synthetic-token',
      url: 'https://adjusternetwork.org',
      unreadNotifications: 10,
    });
    let resolveRequest;
    site.jsonApi = jest.fn(
      () =>
        new Promise(resolve => {
          resolveRequest = resolve;
        }),
    );
    const first = site.notifications(undefined, { silent: false });
    const second = site.notifications(undefined, { silent: false });
    expect(site.jsonApi).toHaveBeenCalledTimes(1);
    resolveRequest({ notifications: [] });
    await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
  });

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

  test('failed authoritative refresh preserves the last valid count', async () => {
    const manager = Object.create(SiteManager.prototype);
    const failure = Object.assign(new Error('api_rate_limited'), {
      status: 429,
    });
    const site = {
      authToken: 'synthetic-token',
      unreadNotifications: 10,
      notifications: jest.fn().mockRejectedValue(failure),
    };
    manager.sites = [site];

    await expect(manager.refreshNotificationState('foreground')).rejects.toBe(
      failure,
    );
    expect(site.unreadNotifications).toBe(10);
  });
});
