jest.mock('@react-native-vector-icons/fontawesome5', () => 'FontAwesome5');

import React from 'react';
import renderer from 'react-test-renderer';
import DiscourseUtils from '../DiscourseUtils';
import { classifyFirstPartyMemberRoute } from '../nativeMemberRouting';
import {
  NOTIFICATION_UNAVAILABLE,
  destinationPresentation,
} from '../notificationDestination';
import { notificationIntent } from '../notificationIntent';
import BadgeEarnedScreen from '../product/BadgeEarnedScreen';

const ORIGIN = 'https://adjusternetwork.org';
const site = {
  url: ORIGIN,
  username: 'tomrodriguez',
  authToken: 'user-api-key',
  isStaff: false,
};
const staffSite = { ...site, isStaff: true };
const member = { authenticated: true, isStaff: false };
const staff = { authenticated: true, isStaff: true };

const intent = (notification, opts = member) =>
  notificationIntent(site, notification, opts);

// The real Discourse granted_badge payload. badge_title is a boolean - whether
// the badge may be worn as a title - not descriptive text, which is why V1
// renders badge_name only (app/services/badge_granter.rb).
const grantedBadge = {
  notification_type: 12,
  topic_id: null,
  post_number: null,
  data: {
    badge_id: 7,
    badge_name: 'Autobiographer',
    badge_slug: 'autobiographer',
    badge_title: false,
    username: 'tomrodriguez',
  },
};

const topicNotification = type => ({
  notification_type: type,
  slug: 'a-discussion',
  topic_id: 41,
  post_number: 3,
  data: { topic_title: 'A discussion' },
});

describe('B: granted_badge resolves to a native badge intent', () => {
  test('badge_name survives directly from the payload', () => {
    expect(intent(grantedBadge)).toEqual({
      kind: 'badge',
      badge: { name: 'Autobiographer' },
    });
  });

  test('the URL form would have lost badge_name, which is why the payload wins', () => {
    // Proof of the architectural reason for the intent layer: the endpoint
    // carries the id and username only.
    const url = DiscourseUtils.endpointForSiteNotification(site, grantedBadge);
    expect(url).toContain('/badges/7/');
    expect(url).not.toContain('Autobiographer');
  });

  test('badge_title is never treated as descriptive text', () => {
    const titled = {
      ...grantedBadge,
      data: { ...grantedBadge.data, badge_title: true },
    };
    expect(intent(titled)).toEqual({
      kind: 'badge',
      badge: { name: 'Autobiographer' },
    });
  });

  test('a badge payload without a usable name falls to the bounded state', () => {
    for (const badge_name of [
      undefined,
      null,
      '',
      '   ',
      42,
      {},
      'x'.repeat(121),
    ]) {
      expect(
        intent({ ...grantedBadge, data: { ...grantedBadge.data, badge_name } }),
      ).toEqual({ kind: 'unavailable' });
    }
    expect(intent({ notification_type: 12 })).toEqual({ kind: 'unavailable' });
  });
});

describe('BadgeEarned screen', () => {
  const render = (name, navigation) => {
    let tree;
    renderer.act(() => {
      tree = renderer.create(
        <BadgeEarnedScreen
          navigation={navigation || { goBack: jest.fn() }}
          route={{ params: { name } }}
        />,
      );
    });
    return tree;
  };

  test('renders the badge name and the earned framing', () => {
    const json = JSON.stringify(render('Autobiographer').toJSON());
    expect(json).toContain('Autobiographer');
    expect(json).toContain('Badge earned');
  });

  test('performs no network request', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('no network expected'));
    render('Autobiographer');
    await Promise.resolve();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('closes through goBack from both the header and the action', () => {
    const goBack = jest.fn();
    const tree = render('Autobiographer', { goBack });
    const pressables = tree.root.findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        (node.props.accessibilityLabel === 'Back' ||
          node.props.accessibilityLabel === 'Close'),
    );
    expect(pressables.length).toBeGreaterThanOrEqual(2);
    for (const node of pressables) {
      renderer.act(() => node.props.onPress());
    }
    expect(goBack).toHaveBeenCalledTimes(pressables.length);
  });
});

describe('A: existing native routing is unchanged', () => {
  test.each([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 17, 18, 20, 24, 25, 27, 28,
    34, 36, 801, 802,
  ])('type %i still opens the Topic screen', type => {
    expect(intent(topicNotification(type))).toEqual({
      kind: 'native',
      screen: 'Topic',
      params: { topicId: 41, url: `${ORIGIN}/t/a-discussion/41/3` },
    });
  });

  test('following notifications still open MemberProfile', () => {
    expect(
      intent({ notification_type: 800, data: { display_username: 'ana' } }),
    ).toMatchObject({ kind: 'native', screen: 'MemberProfile' });
  });

  test('approval_given without a topic opens the profile activity it names', () => {
    // Pre-existing behaviour: the endpoint is /u/:me/activity/approval-given,
    // which the profile pattern already matches. A valid native destination
    // exists, so this is class A and is deliberately left alone.
    expect(intent({ notification_type: 21, data: {} })).toEqual({
      kind: 'native',
      screen: 'MemberProfile',
      params: { username: 'tomrodriguez' },
    });
  });

  test('code review approval opens the topic when it has one', () => {
    expect(
      intent({
        notification_type: 21,
        fancy_title: 'Approved',
        slug: 'a-discussion',
        topic_id: 41,
        post_number: 3,
        data: {},
      }),
    ).toMatchObject({ kind: 'native', screen: 'Topic' });
  });
});

describe('C: unsupported member types reach one bounded state', () => {
  test.each([
    [
      'group_message_summary',
      {
        notification_type: 16,
        data: { username: 'tomrodriguez', group_name: 'staff' },
      },
    ],
    [
      'liked_consolidated',
      { notification_type: 19, data: { username: 'ana' } },
    ],
    [
      'membership_request_accepted',
      { notification_type: 22, data: { group_name: 'adjusters' } },
    ],
    ['membership_request_consolidated', { notification_type: 23, data: {} }],
    ['votes_released', { notification_type: 26, data: {} }],
    [
      'chat_mention',
      {
        notification_type: 29,
        data: {
          chat_channel_id: 2,
          chat_channel_title: 'lounge',
          chat_message_id: 9,
        },
      },
    ],
    [
      'chat_message',
      {
        notification_type: 30,
        data: { chat_channel_id: 2, chat_channel_title: 'lounge' },
      },
    ],
    [
      'chat_invitation',
      {
        notification_type: 31,
        data: { chat_channel_id: 2, chat_channel_title: 'lounge' },
      },
    ],
    [
      'chat_group_mention',
      {
        notification_type: 32,
        data: {
          chat_channel_id: 2,
          chat_channel_title: 'lounge',
          chat_message_id: 9,
        },
      },
    ],
    ['unknown type', { notification_type: 9999, data: {} }],
    ['absent type', { data: {} }],
  ])('%s is unavailable, never a silent no-op', (_label, notification) => {
    expect(intent(notification)).toEqual({ kind: 'unavailable' });
  });

  test('the copy promises no loading, no login and no browser', () => {
    expect(NOTIFICATION_UNAVAILABLE.close).toBe('Close');
    expect(NOTIFICATION_UNAVAILABLE.message).toMatch(/marked as read/i);
    expect(NOTIFICATION_UNAVAILABLE.message).not.toMatch(
      /log ?in|sign ?in|browser|Safari|try again/i,
    );
  });
});

describe('security boundaries', () => {
  test('staff /admin remains the one external handoff', () => {
    for (const type of [37, 38]) {
      expect(
        notificationIntent(
          staffSite,
          { notification_type: type, data: {} },
          staff,
        ),
      ).toEqual({ kind: 'staff_external', url: `${ORIGIN}/admin` });
    }
  });

  test('a member never receives the staff external handoff', () => {
    for (const type of [37, 38]) {
      expect(intent({ notification_type: type, data: {} })).toEqual({
        kind: 'unavailable',
      });
    }
  });

  test('an unauthenticated caller resolves nothing', () => {
    expect(
      notificationIntent(site, grantedBadge, { authenticated: false }),
    ).toEqual({ kind: 'unavailable' });
    expect(
      notificationIntent(site, topicNotification(2), { authenticated: false }),
    ).toEqual({ kind: 'unavailable' });
  });

  test('off-origin and non-canonical destinations stay unavailable', () => {
    const evil = {
      url: 'https://evil.example.com',
      username: 'x',
      authToken: 't',
    };
    expect(notificationIntent(evil, topicNotification(2), member)).toEqual({
      kind: 'unavailable',
    });
  });

  test('destinationPresentation no longer emits a web disposition', () => {
    expect(
      destinationPresentation({ disposition: 'first_party_web', url: ORIGIN }),
    ).toEqual({
      kind: 'denied',
    });
    expect(
      destinationPresentation(
        classifyFirstPartyMemberRoute(`${ORIGIN}/badges/7/basic`, member),
      ),
    ).toEqual({ kind: 'denied' });
  });
});

describe('the experiment is gone and the guard is back', () => {
  const fs = require('fs');
  const path = require('path');
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

  test('webViewSession and the first-party-web allowlist no longer exist', () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'webViewSession.js'))).toBe(
      false,
    );
    expect(read('nativeMemberRouting.js')).not.toContain('first_party_web');
    expect(read('nativeMemberRouting.js')).not.toContain(
      'FIRST_PARTY_WEB_PATHS',
    );
    expect(read('Discourse.js')).not.toContain('webViewSession');
    expect(read('Discourse.js')).not.toContain('_openFirstPartyWeb');
  });

  test('no notification intent can bootstrap a WebView', () => {
    const source = read('Discourse.js');
    const handler = source.slice(
      source.indexOf('  openNotification(site, notification) {'),
      source.indexOf('  // A member must never be trapped'),
    );
    expect(handler).not.toContain('WebView');
    expect(handler).not.toContain('otp');
    expect(handler).toContain("navigate('BadgeEarned'");
    expect(handler).toContain('NOTIFICATION_UNAVAILABLE.title');
  });

  test('the strict WebView navigation guard is restored', () => {
    const source = read('screens/WebViewScreenComponents/WebViewComponent.js');
    expect(source).toContain(
      '// Canonical pages without an explicit native route must not',
    );
    expect(source).not.toContain('pendingDestination');
    expect(source).not.toContain('isOtpBootstrapUrl');
    expect(read('screens/WebViewScreen.js')).not.toContain('destination=');
  });

  test('read-marking still precedes intent resolution', () => {
    const source = read('screens/NotificationsScreen.js');
    const block = source.slice(
      source.indexOf('_openNotificationForSite('),
      source.indexOf('_listIndex(row)'),
    );
    expect(block.indexOf('markNotificationRead')).toBeLessThan(
      block.indexOf('openNotification('),
    );
    // The tap site hands on the notification, not a lossy URL.
    expect(block).not.toContain('endpointForSiteNotification(');
    expect(block).not.toContain('DiscourseUtils');
  });
});
