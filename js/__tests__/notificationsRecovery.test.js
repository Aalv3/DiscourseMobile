/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

jest.mock('@react-native-vector-icons/fontawesome5', () => 'FontAwesome5');

import Site from '../site';
import { classifyNotificationLoadError } from '../notificationLoadState';

describe('notification collection recovery', () => {
  test.each([
    [{ message: 'auth_revoked', status: 401 }, 'unauthorized'],
    [{ message: 'api_rate_limited', status: 429 }, 'rate_limited'],
    [{ message: 'api_request_failed', status: 503 }, 'backend'],
    [{ message: 'network_request_failed' }, 'network'],
  ])('classifies a bounded load failure', (error, expected) => {
    expect(classifyNotificationLoadError(error)).toBe(expected);
  });

  test('surfaces failures to the Notifications screen when requested', async () => {
    const site = new Site({
      authToken: 'synthetic-token',
      clientId: 'synthetic-client',
      url: 'https://adjusternetwork.org',
      unreadNotifications: 1,
    });
    const error = Object.assign(new Error('api_request_failed'), {
      status: 503,
    });
    site.jsonApi = jest.fn().mockRejectedValue(error);

    await expect(
      site.notifications(undefined, { silent: false, surfaceErrors: true }),
    ).rejects.toBe(error);
  });

  test('retains legacy quiet refresh behavior outside the explicit UI path', async () => {
    const site = new Site({
      authToken: 'synthetic-token',
      clientId: 'synthetic-client',
      url: 'https://adjusternetwork.org',
      unreadNotifications: 1,
    });
    site.jsonApi = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(
      site.notifications(undefined, { silent: false }),
    ).resolves.toEqual([]);
  });

  test('screen exposes bounded retry and preserves notification tabs', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'NotificationsScreen.js'),
      'utf8',
    );
    expect(source).toContain('surfaceErrors: true');
    expect(source).toContain('accessibilityLabel="Retry notifications"');
    expect(source).toContain('Notifications are cooling down');
    expect(source).toContain('this.state.dataSource.size > 0');
    expect(source).toContain("i18n.t('new')");
    expect(source).toContain("i18n.t('replies')");
    expect(source).toContain("i18n.t('all')");
  });
});
