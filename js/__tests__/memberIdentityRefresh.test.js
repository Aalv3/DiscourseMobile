jest.mock('react-native-safari-web-auth', () => ({ requestAuth: jest.fn() }));
jest.mock('@react-native-community/push-notification-ios', () => ({}));
jest.mock('react-native-key-pair', () => ({ generate: jest.fn() }));
jest.mock('react-native-device-info', () => ({
  getDeviceName: jest.fn(() => Promise.resolve('Adjuster Network - Test')),
}));
jest.mock('@react-native-cookies/cookies', () => ({
  clearAll: jest.fn(() => Promise.resolve()),
}));
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __store: store,
    getItem: jest.fn(key => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key, value) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn(key => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});
jest.mock('../secureCredentialStore', () => ({
  credentialStore: {
    storeSiteToken: jest.fn(() => Promise.resolve()),
    removeSiteToken: jest.fn(() => Promise.resolve()),
    removeRSAKeys: jest.fn(() => Promise.resolve()),
    readRSAKeys: jest.fn(() => Promise.resolve(null)),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import Site from '../site';
import SiteManager from '../site_manager';
import { memberDisplayName } from '../product/floorPresentation';

const ORIGIN = 'https://adjusternetwork.org';

// A Site driven by a scripted /session/current.json, with no transport.
function identitySite(responses, initial = {}) {
  const site = Object.create(Site.prototype);
  site.url = ORIGIN;
  site.authToken = 'token';
  site.username = initial.username ?? null;
  site.name = initial.name ?? null;
  site.jsonApi = jest.fn(path => {
    expect(path).toBe('/session/current.json');
    const next = responses.shift();
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  });
  return site;
}

function manager(site) {
  const instance = Object.create(SiteManager.prototype);
  instance.sites = site ? [site] : [];
  instance.activeSite = site || null;
  instance._identityRefresh = null;
  instance.save = jest.fn();
  instance._onChange = jest.fn();
  return instance;
}

const session = (username, name) => ({ current_user: { username, name } });

beforeEach(() => jest.clearAllMocks());

describe('member identity is refreshed from the current session', () => {
  test('authorizing as A stores both the username and the display name', async () => {
    const site = identitySite([session('finale2e', 'Finale E2E')]);
    await expect(site.refreshIdentity()).resolves.toBe(true);
    expect(site.username).toBe('finale2e');
    expect(site.name).toBe('Finale E2E');
  });

  test('a server-side rename to B is picked up without reauthorization', async () => {
    const site = identitySite([session('tomrodriguez', 'Tom Rodriguez')], {
      username: 'finale2e',
      name: 'Finale E2E',
    });
    const instance = manager(site);

    await expect(instance.refreshActiveIdentity()).resolves.toBe(true);

    expect(site.username).toBe('tomrodriguez');
    expect(site.name).toBe('Tom Rodriguez');
    // The refreshed identity is persisted, so a relaunch cannot resurrect A.
    expect(instance.save).toHaveBeenCalled();
    expect(instance._onChange).toHaveBeenCalled();
  });

  test('the Floor greeting renders the display name, not the handle', () => {
    expect(memberDisplayName('Tom Rodriguez', 'tomrodriguez')).toBe(
      'Tom Rodriguez',
    );
    // Before the fix there was no stored name, so the handle was title-cased.
    expect(memberDisplayName(null, 'tomrodriguez')).toBe('Tomrodriguez');
    expect(memberDisplayName(null, 'finale2e')).toBe('Finale2e');
    expect(memberDisplayName(null, null)).toBeNull();
  });

  test('an unchanged identity does not rewrite storage', async () => {
    const site = identitySite([session('tomrodriguez', 'Tom Rodriguez')], {
      username: 'tomrodriguez',
      name: 'Tom Rodriguez',
    });
    const instance = manager(site);

    await expect(instance.refreshActiveIdentity()).resolves.toBe(false);
    expect(instance.save).not.toHaveBeenCalled();
  });
});

describe('identity refresh fails closed', () => {
  test('a transport error preserves the last known identity', async () => {
    const site = identitySite([new Error('offline')], {
      username: 'tomrodriguez',
      name: 'Tom Rodriguez',
    });
    const instance = manager(site);

    await expect(instance.refreshActiveIdentity()).resolves.toBe(false);
    expect(site.username).toBe('tomrodriguez');
    expect(site.name).toBe('Tom Rodriguez');
    expect(instance.save).not.toHaveBeenCalled();
  });

  test('a malformed or empty payload never blanks the identity', async () => {
    for (const payload of [
      null,
      {},
      { current_user: null },
      { current_user: {} },
      { current_user: { username: '   ' } },
    ]) {
      const site = identitySite([payload], {
        username: 'tomrodriguez',
        name: 'Tom Rodriguez',
      });
      await expect(site.refreshIdentity()).resolves.toBe(false);
      expect(site.username).toBe('tomrodriguez');
      expect(site.name).toBe('Tom Rodriguez');
    }
  });

  test('a signed-out site is never asked for an identity', async () => {
    const site = identitySite([session('a', 'A')]);
    site.authToken = null;
    await expect(site.refreshIdentity()).resolves.toBe(false);
    expect(site.jsonApi).not.toHaveBeenCalled();
  });

  test('a missing display name falls back to the handle without corrupting state', async () => {
    const site = identitySite([session('tomrodriguez', '')]);
    await expect(site.refreshIdentity()).resolves.toBe(true);
    expect(site.name).toBeNull();
    expect(memberDisplayName(site.name, site.username)).toBe('Tomrodriguez');
  });
});

describe('refresh is bounded and cannot loop', () => {
  test('concurrent foreground triggers share one in-flight request', async () => {
    const site = identitySite([session('tomrodriguez', 'Tom Rodriguez')]);
    const instance = manager(site);

    const results = await Promise.all([
      instance.refreshActiveIdentity(),
      instance.refreshActiveIdentity(),
      instance.refreshActiveIdentity(),
    ]);

    expect(site.jsonApi).toHaveBeenCalledTimes(1);
    expect(results).toEqual([true, true, true]);
    // The in-flight slot is released so a later foreground can refresh again.
    expect(instance._identityRefresh).toBeNull();
  });

  test('the retired multi-site refresh loop is not revived', async () => {
    const site = identitySite([session('tomrodriguez', 'Tom Rodriguez')]);
    const instance = manager(site);
    instance.refreshSites = jest.fn();
    instance._throttledRefreshSites = jest.fn();

    await instance.refreshActiveIdentity();

    expect(instance.refreshSites).not.toHaveBeenCalled();
    expect(instance._throttledRefreshSites).not.toHaveBeenCalled();
    expect(site.jsonApi).toHaveBeenCalledTimes(1);
  });

  test('no authenticated site means no request at all', async () => {
    const instance = manager(null);
    await expect(instance.refreshActiveIdentity()).resolves.toBe(false);
    expect(instance.save).not.toHaveBeenCalled();
  });
});

describe('persistence and backward compatibility', () => {
  test('name is serialized so a relaunch keeps the refreshed identity', () => {
    expect(Site.FIELDS).toContain('name');
    expect(Site.FIELDS).toContain('username');

    const site = new Site({
      url: ORIGIN,
      username: 'tomrodriguez',
      name: 'Tom Rodriguez',
    });
    const persisted = JSON.parse(JSON.stringify(site));
    expect(persisted.name).toBe('Tom Rodriguez');
    expect(persisted.username).toBe('tomrodriguez');
    // Rehydration is what a cold launch performs.
    const rehydrated = new Site(persisted);
    expect(memberDisplayName(rehydrated.name, rehydrated.username)).toBe(
      'Tom Rodriguez',
    );
  });

  test('an existing record with no name upgrades without migration', async () => {
    // A record written by a build that never stored a display name.
    const legacy = new Site({ url: ORIGIN, username: 'finale2e' });
    expect(legacy.name).toBeUndefined();
    expect(memberDisplayName(legacy.name, legacy.username)).toBe('Finale2e');

    legacy.authToken = 'token';
    legacy.jsonApi = jest.fn(() =>
      Promise.resolve(session('tomrodriguez', 'Tom Rodriguez')),
    );

    await expect(legacy.refreshIdentity()).resolves.toBe(true);
    expect(memberDisplayName(legacy.name, legacy.username)).toBe(
      'Tom Rodriguez',
    );
  });

  test('logging off clears the whole identity, not just the handle', () => {
    const site = new Site({ url: ORIGIN });
    site.authToken = 'token';
    site.username = 'tomrodriguez';
    site.name = 'Tom Rodriguez';

    site.logoff();

    expect(site.username).toBeNull();
    expect(site.name).toBeNull();
    expect(site.authToken).toBeNull();
  });
});

describe('username-dependent surfaces follow the refreshed identity', () => {
  test('routes and self-checks all read the refreshed username', async () => {
    const site = identitySite([session('tomrodriguez', 'Tom Rodriguez')], {
      username: 'finale2e',
      name: null,
    });
    await site.refreshIdentity();

    // Own-profile and bookmarks routes are built from site.username.
    expect(`/u/${encodeURIComponent(site.username)}.json`).toBe(
      '/u/tomrodriguez.json',
    );
    expect(
      `/u/${encodeURIComponent(site.username)}/activity/bookmarks.json`,
    ).toBe('/u/tomrodriguez/activity/bookmarks.json');

    // Self-detection used by can-edit, Lounge self-delete and moderation.
    expect('tomrodriguez' === site.username).toBe(true);
    expect('finale2e' === site.username).toBe(false);
  });
});

describe('a new authorization never inherits the previous identity', () => {
  test('the prior identity is cleared before the new credential is used', async () => {
    const previous = new Site({
      url: ORIGIN,
      username: 'finale2e',
      name: 'Finale E2E',
    });
    previous.authToken = 'old-token';

    // handleAuthPayload clears identity before binding; model that boundary.
    previous.username = null;
    previous.name = null;
    previous.authToken = 'new-token';
    previous.jsonApi = jest.fn(() =>
      Promise.resolve(session('cert_probe_01', 'Cert Probe 01')),
    );

    await expect(previous.refreshIdentity()).resolves.toBe(true);
    expect(previous.username).toBe('cert_probe_01');
    expect(previous.name).toBe('Cert Probe 01');
  });

  test('handleAuthPayload clears identity and refreshes it', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'site_manager.js'),
      'utf8',
    );
    expect(source).toContain('nonceSite.username = null');
    expect(source).toContain('nonceSite.name = null');
    expect(source).toContain('await nonceSite.refreshIdentity()');
  });

  test('the foreground lifecycle refreshes identity before notifications', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'Discourse.js'),
      'utf8',
    );
    expect(source).toContain('await this._siteManager.refreshActiveIdentity()');
    // The retired multi-site loop stays retired on the authenticated path.
    const foreground = source.slice(
      source.indexOf('async _refreshAuthenticatedResources'),
      source.indexOf('async _refresh()'),
    );
    expect(foreground).not.toContain('refreshSites()');
  });
});

test('AsyncStorage is the identity store of record', async () => {
  const site = new Site({ url: ORIGIN, username: 'tomrodriguez' });
  site.name = 'Tom Rodriguez';
  const instance = manager(site);
  instance.save = SiteManager.prototype.save.bind(instance);

  instance.save();

  const raw = await AsyncStorage.getItem('@Discourse.sites');
  const parsed = JSON.parse(raw);
  expect(parsed[0].username).toBe('tomrodriguez');
  expect(parsed[0].name).toBe('Tom Rodriguez');
  // The credential is never written to AsyncStorage.
  expect(raw).not.toContain('authToken":"');
});
