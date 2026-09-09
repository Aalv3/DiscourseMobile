import DiscourseUtils from '../DiscourseUtils';
import {
  classifyFirstPartyMemberRoute,
  isFirstPartyWebPath,
} from '../nativeMemberRouting';

const ORIGIN = 'https://adjusternetwork.org';
const site = { url: ORIGIN, username: 'tomrodriguez', isStaff: false };
const member = { authenticated: true, isStaff: false };
const staff = { authenticated: true, isStaff: true };

const routeFor = (notification, opts = member) =>
  classifyFirstPartyMemberRoute(
    DiscourseUtils.endpointForSiteNotification(site, notification),
    opts,
  );

// The real Discourse granted_badge payload: badge_id and username present,
// topic_id and post_number absent (app/services/badge_granter.rb).
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

describe('granted_badge (Autobiographer) now reaches a destination', () => {
  test('produces a valid badge URL', () => {
    expect(DiscourseUtils.endpointForSiteNotification(site, grantedBadge)).toBe(
      `${ORIGIN}/badges/7/basic?username=tomrodriguez`,
    );
  });

  test('classifies as first_party_web, not rejected', () => {
    expect(routeFor(grantedBadge)).toEqual({
      disposition: 'first_party_web',
      url: `${ORIGIN}/badges/7/basic?username=tomrodriguez`,
    });
  });

  test('nil topic_id and post_number do not suppress the destination', () => {
    expect(grantedBadge.topic_id).toBeNull();
    expect(grantedBadge.post_number).toBeNull();
    expect(routeFor(grantedBadge).disposition).toBe('first_party_web');
  });
});

describe('every previously silent notification class now routes', () => {
  test.each([
    [
      'group_message_summary',
      {
        notification_type: 16,
        data: { username: 'tomrodriguez', group_name: 'staff' },
      },
      '/u/tomrodriguez/messages/group/staff',
    ],
    [
      'liked_consolidated',
      { notification_type: 19, data: { username: 'someone' } },
      '/u/tomrodriguez/notifications/likes-received?acting_username=someone',
    ],
    [
      'membership_request_accepted',
      { notification_type: 22, data: { group_name: 'staff' } },
      '/g/staff',
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
      '/chat/channel/2/lounge?messageId=9',
    ],
    [
      'chat_message',
      {
        notification_type: 30,
        data: { chat_channel_id: 2, chat_channel_title: 'lounge' },
      },
      '/chat/channel/2/lounge',
    ],
  ])('%s opens first_party_web', (_label, notification, expectedPath) => {
    const url = DiscourseUtils.endpointForSiteNotification(site, notification);
    expect(url).toBe(`${ORIGIN}${expectedPath}`);
    expect(routeFor(notification)).toEqual({
      disposition: 'first_party_web',
      url,
    });
  });
});

describe('existing native routing is unchanged', () => {
  const topicish = { slug: 'a-topic', topic_id: 42, post_number: 3, data: {} };

  test.each([1, 2, 3, 5, 9, 11, 17, 24, 28, 36, 801, 802])(
    'type %i still opens the native Topic screen',
    type => {
      const route = routeFor({ notification_type: type, ...topicish });
      expect(route.disposition).toBe('native');
      expect(route.screen).toBe('Topic');
    },
  );

  test('following and approval notifications still open MemberProfile', () => {
    expect(
      routeFor({
        notification_type: 800,
        data: { display_username: 'someone' },
      }),
    ).toMatchObject({ disposition: 'native', screen: 'MemberProfile' });
    expect(routeFor({ notification_type: 21, data: {} })).toMatchObject({
      disposition: 'native',
      screen: 'MemberProfile',
    });
  });

  test.each([
    ['/search', 'Search'],
    ['/u/tomrodriguez/activity/bookmarks', 'Bookmarks'],
    ['/u/tomrodriguez', 'MemberProfile'],
    ['/u/tomrodriguez/preferences', 'Settings'],
    ['/new-topic', 'Ask'],
    ['/c/field-notes/12', 'Collection'],
    ['/tag/roofing', 'Collection'],
  ])('%s still resolves natively to %s', (path, screen) => {
    const route = classifyFirstPartyMemberRoute(`${ORIGIN}${path}`, member);
    expect(route.disposition).toBe('native');
    expect(route.screen).toBe(screen);
  });
});

describe('security boundaries are preserved', () => {
  test('off-origin destinations remain rejected', () => {
    for (const url of [
      'https://evil.example.com/badges/7/basic',
      'https://adjusternetwork.org.evil.example.com/g/staff',
      'https://staging.adjusternetwork.org/chat/channel/2/lounge',
      'http://adjusternetwork.org/badges/7/basic',
    ]) {
      expect(classifyFirstPartyMemberRoute(url, member)).toEqual({
        disposition: 'rejected',
      });
    }
  });

  test('non-staff /admin remains rejected and staff behaviour is unchanged', () => {
    expect(routeFor({ notification_type: 37, data: {} })).toEqual({
      disposition: 'rejected',
    });
    expect(routeFor({ notification_type: 37, data: {} }, staff)).toEqual({
      disposition: 'privileged_external',
      url: `${ORIGIN}/admin`,
    });
  });

  test('unknown or empty notification endpoints remain rejected', () => {
    expect(routeFor({ notification_type: 999, data: {} })).toEqual({
      disposition: 'rejected',
    });
    expect(classifyFirstPartyMemberRoute(ORIGIN, member)).toEqual({
      disposition: 'rejected',
    });
    expect(classifyFirstPartyMemberRoute(`${ORIGIN}/`, member)).toEqual({
      disposition: 'rejected',
    });
  });

  test('a malformed badge payload fails safely rather than opening', () => {
    for (const data of [
      {},
      { username: 'tomrodriguez' },
      { badge_id: 'not-a-number', username: 'tomrodriguez' },
      { badge_id: null, username: null },
    ]) {
      expect(
        routeFor({
          notification_type: 12,
          topic_id: null,
          post_number: null,
          data,
        }),
      ).toEqual({ disposition: 'rejected' });
    }
  });

  test('unauthenticated callers never route anywhere', () => {
    expect(
      classifyFirstPartyMemberRoute(`${ORIGIN}/badges/7/basic`, {
        authenticated: false,
      }),
    ).toEqual({ disposition: 'rejected' });
  });

  test('the allowlist is not a blanket internal fallback', () => {
    for (const path of [
      '/latest',
      '/site.json',
      '/badges',
      '/badgesx/7/basic',
      '/chat',
      '/chat/channel',
      '/chat/channel/abc/lounge',
      '/gx/staff',
      '/u/tomrodriguez/messagesx',
    ]) {
      expect(isFirstPartyWebPath(path)).toBe(false);
      expect(
        classifyFirstPartyMemberRoute(`${ORIGIN}${path}`, member).disposition,
      ).not.toBe('first_party_web');
    }
  });
});

describe('the tap handler marks read before navigating and has no silent path', () => {
  const fs = require('fs');
  const path = require('path');

  test('read-marking precedes destination resolution', () => {
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

  test('openUrl handles every presentation explicitly', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'Discourse.js'),
      'utf8',
    );
    const openUrl = source.slice(
      source.indexOf('  openUrl(url) {'),
      source.indexOf('  _toggleTheme('),
    );
    // Dispositions are now mapped by the pure destinationPresentation module,
    // and openUrl branches on the resulting kind. Every kind is handled.
    expect(openUrl).toContain('destinationPresentation(route)');
    for (const kind of ['native', 'unavailable', 'external']) {
      expect(openUrl).toContain(`presentation.kind === '${kind}'`);
    }
    // The denied path is explicit, not an implicit fallthrough.
    expect(openUrl).toContain("securityEvent('navigation.rejected')");
    // A first-party web destination must never load the unauthenticated
    // WebView; it shows the explicit unavailable state instead.
    expect(openUrl).not.toContain("navigate('WebView'");
    expect(openUrl).toContain(
      "securityEvent('navigation.first_party_web_unavailable')",
    );
  });
});
