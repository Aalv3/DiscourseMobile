import DiscourseUtils from '../DiscourseUtils';
import { classifyFirstPartyMemberRoute } from '../nativeMemberRouting';

// Salvaged from the notification-routing experiment's suite. These assert the
// URL-level classifier boundaries, which are unchanged by the move to native
// notification intents and are still the last line of defence for deep links.
const ORIGIN = 'https://adjusternetwork.org';
const site = { url: ORIGIN, username: 'tomrodriguez', isStaff: false };
const member = { authenticated: true, isStaff: false };
const staff = { authenticated: true, isStaff: true };

const routeFor = (notification, opts = member) =>
  classifyFirstPartyMemberRoute(
    DiscourseUtils.endpointForSiteNotification(site, notification),
    opts,
  );

describe('member route classifier boundaries', () => {
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

  test('unauthenticated callers never route anywhere', () => {
    expect(
      classifyFirstPartyMemberRoute(`${ORIGIN}/badges/7/basic`, {
        authenticated: false,
      }),
    ).toEqual({ disposition: 'rejected' });
  });

  test('canonical pages without a native screen are rejected, not opened', () => {
    // The first-party-web allowlist is gone: an internal page with no native
    // screen must not fall through to a WebView.
    for (const path of [
      '/badges/7/basic',
      '/g/staff',
      '/chat/channel/2/lounge',
      '/u/tomrodriguez/messages/group/staff',
      '/latest',
      '/site.json',
      '/badges',
    ]) {
      expect(
        classifyFirstPartyMemberRoute(`${ORIGIN}${path}`, member).disposition,
      ).toBe('rejected');
    }
  });

  test('openUrl handles every remaining presentation explicitly', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'Discourse.js'),
      'utf8',
    );
    const openUrl = source.slice(
      source.indexOf('  openUrl(url) {'),
      source.indexOf('  _navigateNative('),
    );
    expect(openUrl).toContain('destinationPresentation(route)');
    for (const kind of ['native', 'external']) {
      expect(openUrl).toContain(`presentation.kind === '${kind}'`);
    }
    // The web kind no longer exists, and deep links never open a WebView.
    expect(openUrl).not.toContain("presentation.kind === 'web'");
    expect(openUrl).not.toContain("navigate('WebView'");
    expect(openUrl).toContain("securityEvent('navigation.rejected')");
  });
});
