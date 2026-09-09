import DiscourseUtils from '../DiscourseUtils';
import { classifyFirstPartyMemberRoute } from '../nativeMemberRouting';
import {
  FIRST_PARTY_WEB_UNAVAILABLE,
  destinationPresentation,
  opensWebView,
} from '../notificationDestination';

const ORIGIN = 'https://adjusternetwork.org';
const site = { url: ORIGIN, username: 'tomrodriguez', isStaff: false };
const member = { authenticated: true, isStaff: false };
const staff = { authenticated: true, isStaff: true };

const present = (notification, opts = member) =>
  destinationPresentation(
    classifyFirstPartyMemberRoute(
      DiscourseUtils.endpointForSiteNotification(site, notification),
      opts,
    ),
  );

// Autobiographer is badge id 9 on production.
const autobiographer = {
  notification_type: 12,
  topic_id: null,
  post_number: null,
  data: {
    badge_id: 9,
    badge_name: 'Autobiographer',
    badge_slug: 'autobiographer',
    username: 'tomrodriguez',
  },
};
const basicBadge = {
  notification_type: 12,
  topic_id: null,
  post_number: null,
  data: {
    badge_id: 1,
    badge_name: 'Basic',
    badge_slug: 'basic',
    username: 'tomrodriguez',
  },
};

describe('Autobiographer produces an explicit unavailable state', () => {
  test('not a blank WebView', () => {
    const presentation = present(autobiographer);
    expect(presentation.kind).toBe('unavailable');
    expect(presentation.kind).not.toBe('webview');
    expect(presentation.copy).toEqual(FIRST_PARTY_WEB_UNAVAILABLE);
  });

  test('the destination is still recognised, not denied', () => {
    const route = classifyFirstPartyMemberRoute(
      DiscourseUtils.endpointForSiteNotification(site, autobiographer),
      member,
    );
    expect(route).toEqual({
      disposition: 'first_party_web',
      url: `${ORIGIN}/badges/9/basic?username=tomrodriguez`,
    });
  });

  test('the copy is explicit, offers a close, and promises no loading', () => {
    expect(FIRST_PARTY_WEB_UNAVAILABLE.title).toBe('Not available in the app');
    expect(FIRST_PARTY_WEB_UNAVAILABLE.close).toBe('Close');
    expect(FIRST_PARTY_WEB_UNAVAILABLE.message).toMatch(/cannot open yet/i);
    expect(FIRST_PARTY_WEB_UNAVAILABLE.message).toMatch(/marked as read/i);
    // No login prompt, no external hand-off, no loading language.
    expect(FIRST_PARTY_WEB_UNAVAILABLE.message).not.toMatch(
      /log ?in|sign ?in|browser|Safari|loading/i,
    );
  });

  test('Basic behaves identically to Autobiographer', () => {
    expect(present(basicBadge)).toEqual(present(autobiographer));
  });
});

describe('every first_party_web class behaves consistently', () => {
  test.each([
    ['granted_badge', autobiographer],
    [
      'group_message_summary',
      {
        notification_type: 16,
        data: { username: 'tomrodriguez', group_name: 'staff' },
      },
    ],
    [
      'liked_consolidated',
      { notification_type: 19, data: { username: 'someone' } },
    ],
    [
      'membership_request_accepted',
      { notification_type: 22, data: { group_name: 'staff' } },
    ],
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
  ])(
    '%s shows the same unavailable state and loads no WebView',
    (_label, notification) => {
      const presentation = present(notification);
      expect(presentation).toEqual({
        kind: 'unavailable',
        copy: FIRST_PARTY_WEB_UNAVAILABLE,
      });
      expect(
        opensWebView(
          classifyFirstPartyMemberRoute(
            DiscourseUtils.endpointForSiteNotification(site, notification),
            member,
          ),
        ),
      ).toBe(false);
    },
  );
});

describe('existing native notification routing is unchanged', () => {
  const topicish = { slug: 'a-topic', topic_id: 42, post_number: 3, data: {} };

  test.each([1, 2, 3, 5, 9, 11, 17, 24, 28, 36, 801, 802])(
    'type %i still presents the native Topic screen',
    type => {
      expect(present({ notification_type: type, ...topicish })).toMatchObject({
        kind: 'native',
        screen: 'Topic',
      });
    },
  );

  test('following and approval still present native MemberProfile', () => {
    expect(
      present({
        notification_type: 800,
        data: { display_username: 'someone' },
      }),
    ).toMatchObject({
      kind: 'native',
      screen: 'MemberProfile',
    });
    expect(present({ notification_type: 21, data: {} })).toMatchObject({
      kind: 'native',
      screen: 'MemberProfile',
    });
  });

  test('staff /admin still hands off externally; non-staff is denied', () => {
    expect(present({ notification_type: 37, data: {} }, staff)).toEqual({
      kind: 'external',
      url: `${ORIGIN}/admin`,
    });
    expect(present({ notification_type: 37, data: {} })).toEqual({
      kind: 'denied',
    });
  });
});

describe('unsafe and unknown destinations stay denied', () => {
  test('malformed badge payloads are denied, never unavailable-state', () => {
    for (const data of [
      {},
      { username: 'x' },
      { badge_id: 'abc', username: 'x' },
      { badge_id: null, username: null },
    ]) {
      expect(
        present({
          notification_type: 12,
          topic_id: null,
          post_number: null,
          data,
        }),
      ).toEqual({
        kind: 'denied',
      });
    }
  });

  test('unknown type and empty endpoint denied', () => {
    expect(present({ notification_type: 999, data: {} })).toEqual({
      kind: 'denied',
    });
  });

  test('off-origin denied', () => {
    for (const url of [
      'https://evil.example.com/badges/9/basic',
      'https://adjusternetwork.org.evil.example.com/g/staff',
      'http://adjusternetwork.org/badges/9/basic',
    ]) {
      expect(
        destinationPresentation(classifyFirstPartyMemberRoute(url, member)),
      ).toEqual({
        kind: 'denied',
      });
    }
  });

  test('unauthenticated callers are denied', () => {
    expect(
      destinationPresentation(
        classifyFirstPartyMemberRoute(`${ORIGIN}/badges/9/basic`, {
          authenticated: false,
        }),
      ),
    ).toEqual({ kind: 'denied' });
  });

  test('a missing or malformed route object is denied, not crashed', () => {
    for (const route of [
      undefined,
      null,
      {},
      { disposition: 'something_new' },
    ]) {
      expect(destinationPresentation(route)).toEqual({ kind: 'denied' });
    }
  });
});

describe('no destination opens the WebView, and read-marking still precedes navigation', () => {
  const fs = require('fs');
  const path = require('path');

  test('openUrl never navigates to the WebView screen', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'Discourse.js'),
      'utf8',
    );
    const openUrl = source.slice(
      source.indexOf('  openUrl(url) {'),
      source.indexOf('  _toggleTheme('),
    );
    expect(openUrl).not.toContain("navigate('WebView'");
    expect(openUrl).toContain("presentation.kind === 'unavailable'");
    expect(openUrl).toContain("presentation.kind === 'external'");
    expect(openUrl).toContain("securityEvent('navigation.rejected')");
  });

  test('the tap handler marks read before resolving a destination', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'NotificationsScreen.js'),
      'utf8',
    );
    const handler = source.slice(
      source.indexOf('_openNotificationForSite('),
      source.indexOf('_listIndex(row)'),
    );
    expect(handler.indexOf('markNotificationRead')).toBeLessThan(
      handler.indexOf('endpointForSiteNotification'),
    );
    expect(handler).toContain('openUrl(url)');
  });
});
