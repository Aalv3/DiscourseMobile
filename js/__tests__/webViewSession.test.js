jest.mock('@react-native-cookies/cookies', () => ({ get: jest.fn() }));

import CookieManager from '@react-native-cookies/cookies';
import DiscourseUtils from '../DiscourseUtils';
import { classifyFirstPartyMemberRoute } from '../nativeMemberRouting';
import {
  WEB_SESSION_UNAVAILABLE,
  destinationPresentation,
} from '../notificationDestination';
import {
  OTP_ENDPOINT,
  hasAuthenticatedWebSession,
  isOtpBootstrapUrl,
  otpBootstrapUrl,
  requestOneTimePassword,
  resolveWebSessionEntry,
} from '../webViewSession';

const ORIGIN = 'https://adjusternetwork.org';
const OTP = 'a1b2c3d4e5f6';
const BADGE = `${ORIGIN}/badges/9/basic?username=tomrodriguez`;

const makeSite = (overrides = {}) => ({
  url: ORIGIN,
  username: 'tomrodriguez',
  authToken: 'user-api-key',
  clientId: 'client-A',
  jsonApi: jest.fn(),
  ...overrides,
});

const makeManager = (overrides = {}) => ({
  ensureRSAKeys: jest.fn(() => Promise.resolve()),
  rsaKeys: { public: 'PUBLIC-KEY', private: 'PRIVATE-KEY' },
  decryptHelper: jest.fn(() => OTP),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  CookieManager.get.mockResolvedValue({});
});

describe('OTP request uses the existing credentials and crypto', () => {
  test('posts the app public key, governed redirect and pkcs1 padding', async () => {
    const site = makeSite();
    const manager = makeManager();
    site.jsonApi.mockResolvedValue({
      redirect_url: `adjusternetwork://adjusternetwork.org/auth_redirect?oneTimePassword=ENCRYPTED`,
    });

    await expect(requestOneTimePassword(site, manager)).resolves.toBe(OTP);

    // Reuses site.jsonApi, so User-Api-Key / User-Api-Client-Id headers and
    // the rate-limit buckets apply unchanged.
    expect(site.jsonApi).toHaveBeenCalledWith(OTP_ENDPOINT, 'POST', {
      public_key: 'PUBLIC-KEY',
      auth_redirect: 'adjusternetwork://adjusternetwork.org/auth_redirect',
      padding: 'pkcs1',
    });
    // Same RSA machinery as the authorization flow; no second implementation.
    expect(manager.ensureRSAKeys).toHaveBeenCalled();
    expect(manager.decryptHelper).toHaveBeenCalledWith('ENCRYPTED');
  });

  test('an unauthenticated site never requests an OTP', async () => {
    const site = makeSite({ authToken: null });
    await expect(requestOneTimePassword(site, makeManager())).rejects.toThrow(
      'web_session_unauthenticated',
    );
    expect(site.jsonApi).not.toHaveBeenCalled();
  });

  test('a missing RSA public key fails before any request', async () => {
    const site = makeSite();
    await expect(
      requestOneTimePassword(site, makeManager({ rsaKeys: {} })),
    ).rejects.toThrow('web_session_key_unavailable');
    expect(site.jsonApi).not.toHaveBeenCalled();
  });

  test('a response without an OTP fails closed', async () => {
    const site = makeSite();
    for (const redirect_url of [
      undefined,
      '',
      'adjusternetwork://adjusternetwork.org/auth_redirect',
      'https://evil.example.com/?oneTimePassword=X',
    ]) {
      site.jsonApi.mockResolvedValue({ redirect_url });
      await expect(requestOneTimePassword(site, makeManager())).rejects.toThrow(
        'web_session_otp_missing',
      );
    }
  });

  test('a non-hex decrypted OTP is refused so nothing is injected into the path', async () => {
    const site = makeSite();
    site.jsonApi.mockResolvedValue({
      redirect_url: `adjusternetwork://adjusternetwork.org/auth_redirect?oneTimePassword=E`,
    });
    for (const bad of ['../../admin', 'abc/def', 'ZZZZ', '', null]) {
      await expect(
        requestOneTimePassword(site, makeManager({ decryptHelper: () => bad })),
      ).rejects.toThrow('web_session_otp_invalid');
    }
  });

  test('a rate-limited or failing OTP request propagates', async () => {
    const site = makeSite();
    site.jsonApi.mockRejectedValue(
      Object.assign(new Error('api_rate_limited'), { status: 429 }),
    );
    await expect(requestOneTimePassword(site, makeManager())).rejects.toThrow(
      'api_rate_limited',
    );
  });
});

describe('bootstrap URL construction is constrained', () => {
  test('builds the confirmation route for a hex token only', () => {
    expect(otpBootstrapUrl({ url: ORIGIN }, OTP)).toBe(
      `${ORIGIN}/session/otp/${OTP}`,
    );
    for (const bad of ['../admin', 'a/b', 'ZZ', '', null, undefined]) {
      expect(otpBootstrapUrl({ url: ORIGIN }, bad)).toBeNull();
    }
    expect(otpBootstrapUrl(null, OTP)).toBeNull();
  });

  test('recognises only canonical-origin HTTPS bootstrap URLs', () => {
    expect(isOtpBootstrapUrl(`${ORIGIN}/session/otp/${OTP}`)).toBe(true);
    for (const bad of [
      `${ORIGIN}/badges/9/basic`,
      `https://evil.example.com/session/otp/${OTP}`,
      `http://adjusternetwork.org/session/otp/${OTP}`,
      `https://adjusternetwork.org.evil.example.com/session/otp/${OTP}`,
      'not-a-url',
      null,
    ]) {
      expect(isOtpBootstrapUrl(bad)).toBe(false);
    }
  });
});

describe('an existing session is reused rather than minting another OTP', () => {
  test('a live auth cookie skips the bootstrap entirely', async () => {
    CookieManager.get.mockResolvedValue({ _t: { value: 'session-token' } });
    const site = makeSite();
    await expect(hasAuthenticatedWebSession(site, CookieManager)).resolves.toBe(
      true,
    );

    await expect(
      resolveWebSessionEntry(site, makeManager(), BADGE),
    ).resolves.toEqual({ url: BADGE, destination: null });
    expect(site.jsonApi).not.toHaveBeenCalled();
  });

  test('an absent or empty cookie bootstraps and remembers the destination', async () => {
    for (const jar of [{}, { _t: {} }, { _t: { value: '' } }, null]) {
      CookieManager.get.mockResolvedValue(jar);
      const site = makeSite();
      site.jsonApi.mockResolvedValue({
        redirect_url: `adjusternetwork://adjusternetwork.org/auth_redirect?oneTimePassword=E`,
      });
      await expect(
        resolveWebSessionEntry(site, makeManager(), BADGE),
      ).resolves.toEqual({
        url: `${ORIGIN}/session/otp/${OTP}`,
        destination: BADGE,
      });
      expect(site.jsonApi).toHaveBeenCalledTimes(1);
    }
  });

  test('an unreadable cookie jar bootstraps rather than assuming a session', async () => {
    CookieManager.get.mockRejectedValue(new Error('cookie failure'));
    await expect(
      hasAuthenticatedWebSession(makeSite(), CookieManager),
    ).resolves.toBe(false);
  });

  test('an off-origin destination is refused before any OTP is minted', async () => {
    const site = makeSite();
    for (const bad of [
      'https://evil.example.com/badges/9/basic',
      'http://adjusternetwork.org/badges/9/basic',
      null,
    ]) {
      await expect(
        resolveWebSessionEntry(site, makeManager(), bad),
      ).rejects.toThrow('web_session_destination');
    }
    expect(site.jsonApi).not.toHaveBeenCalled();
  });
});

describe('destination presentation', () => {
  const site = { url: ORIGIN, username: 'tomrodriguez' };
  const member = { authenticated: true, isStaff: false };
  const present = (n, o = member) =>
    destinationPresentation(
      classifyFirstPartyMemberRoute(
        DiscourseUtils.endpointForSiteNotification(site, n),
        o,
      ),
    );

  test('granted_badge presents a web destination', () => {
    expect(
      present({
        notification_type: 12,
        topic_id: null,
        post_number: null,
        data: { badge_id: 9, username: 'tomrodriguez' },
      }),
    ).toEqual({ kind: 'web', url: BADGE });
  });

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
  ])('%s presents a web destination', (_l, n) => {
    expect(present(n).kind).toBe('web');
  });

  test('native notification routing is unchanged', () => {
    expect(
      present({
        notification_type: 2,
        slug: 't',
        topic_id: 4,
        post_number: 1,
        data: {},
      }),
    ).toMatchObject({ kind: 'native', screen: 'Topic' });
    expect(
      present({ notification_type: 800, data: { display_username: 'x' } }),
    ).toMatchObject({ kind: 'native', screen: 'MemberProfile' });
  });

  test('denied destinations stay denied', () => {
    expect(present({ notification_type: 37, data: {} })).toEqual({
      kind: 'denied',
    });
    expect(present({ notification_type: 999, data: {} })).toEqual({
      kind: 'denied',
    });
    expect(
      present({
        notification_type: 12,
        data: { badge_id: 'abc', username: 'x' },
      }),
    ).toEqual({ kind: 'denied' });
    expect(
      destinationPresentation(
        classifyFirstPartyMemberRoute(BADGE, { authenticated: false }),
      ),
    ).toEqual({ kind: 'denied' });
    expect(destinationPresentation(null)).toEqual({ kind: 'denied' });
  });

  test('staff admin still hands off externally', () => {
    expect(
      present(
        { notification_type: 37, data: {} },
        { authenticated: true, isStaff: true },
      ),
    ).toEqual({ kind: 'external', url: `${ORIGIN}/admin` });
  });
});

describe('failure is bounded and explicit', () => {
  test('the failure copy promises no loading and no login', () => {
    expect(WEB_SESSION_UNAVAILABLE.close).toBe('Close');
    expect(WEB_SESSION_UNAVAILABLE.message).toMatch(/marked as read/i);
    expect(WEB_SESSION_UNAVAILABLE.message).not.toMatch(
      /log ?in|sign ?in|browser|Safari/i,
    );
  });
});

describe('wiring', () => {
  const fs = require('fs');
  const path = require('path');
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

  test('openUrl delegates web destinations and bounds failure', () => {
    const source = read('Discourse.js');
    const openUrl = source.slice(
      source.indexOf('  openUrl(url) {'),
      source.indexOf('  async _openFirstPartyWeb('),
    );
    expect(openUrl).toContain("presentation.kind === 'web'");
    expect(openUrl).toContain(
      'this._openFirstPartyWeb(site, presentation.url)',
    );
    expect(openUrl).toContain("securityEvent('navigation.rejected')");
    // openUrl itself never opens the WebView: a web destination must go
    // through session resolution first.
    expect(openUrl).not.toContain("navigate('WebView'");

    const handler = source.slice(
      source.indexOf('  async _openFirstPartyWeb('),
      source.indexOf('  _toggleTheme('),
    );
    // The WebView is reached only after the session entry resolves, and any
    // failure ends in the bounded explicit state.
    expect(handler.indexOf('resolveWebSessionEntry(')).toBeLessThan(
      handler.indexOf("navigate('WebView'"),
    );
    expect(handler).toContain(
      "securityEvent('navigation.web_session_unavailable')",
    );
    expect(handler).toContain('WEB_SESSION_UNAVAILABLE.title');
  });

  test('the WebView policy relaxation is bootstrap-scoped, not standing', () => {
    const source = read('screens/WebViewScreenComponents/WebViewComponent.js');
    // The original guard survives.
    expect(source).toContain(
      '// Canonical pages without an explicit native route must not',
    );
    expect(source).toContain('_isAuthorizedSessionNavigation(request.url)');
    // Authorization requires an app-initiated bootstrap.
    expect(source).toContain(
      'isOtpBootstrapUrl(url) && Boolean(this.props.destination)',
    );
    // The window closes once the destination loads.
    expect(source).toContain(
      'pendingDestination: null, webviewUrl: destination',
    );
    expect(read('screens/WebViewScreen.js')).toContain(
      'destination={this.props.route.params.destination}',
    );
  });

  test('read-marking still precedes destination resolution', () => {
    const handler = read('screens/NotificationsScreen.js');
    const block = handler.slice(
      handler.indexOf('_openNotificationForSite('),
      handler.indexOf('_listIndex(row)'),
    );
    expect(block.indexOf('markNotificationRead')).toBeLessThan(
      block.indexOf('endpointForSiteNotification'),
    );
  });
});
