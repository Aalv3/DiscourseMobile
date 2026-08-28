/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';
import DiscourseUtils from '../DiscourseUtils';
import {
  actionableUnreadRows,
  supportedNotification,
} from '../notificationState';

describe('supported notification types', () => {
  test('Discourse admin-problems type 38 is actionable and routes safely', () => {
    const notification = { notification_type: 38, read: false };
    expect(supportedNotification(notification)).toBe(true);
    expect(
      DiscourseUtils.endpointForSiteNotification(
        { url: 'https://adjusternetwork.org' },
        notification,
      ),
    ).toBe('https://adjusternetwork.org/admin');
    expect(DiscourseUtils.iconNameForNotification(notification)).toBe(
      'exclamation-triangle',
    );
  });

  test('unknown types never enter actionable New or its badge count', () => {
    expect(
      actionableUnreadRows([
        { notification: { notification_type: 9999, read: false } },
      ]),
    ).toEqual([]);
  });

  test('the user-facing renderer contains no Unmapped type fallback', () => {
    const source = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        'screens',
        'NotificationsScreenComponents',
        'NotificationRow.js',
      ),
      'utf8',
    );
    expect(source).not.toContain('Unmapped type');
    expect(source).toContain('Site administration needs attention');
  });
});
