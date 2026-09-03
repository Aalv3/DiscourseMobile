import fs from 'fs';
import path from 'path';

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

import SafariWebAuth from 'react-native-safari-web-auth';
import SiteManager from '../site_manager';
import { credentialStore } from '../secureCredentialStore';
import { EPHEMERAL_AUTH_SESSION, requestIOSAuth } from '../iosAuthSession';
import { isSafeAuthCallback } from '../adjusterNetworkSecurity';
import { AUTH_REDIRECT } from '../authorizationConsent';
import {
  AUTHORIZATION_PROFILE_ID,
  REQUIRED_AUTHORIZATION_SCOPES,
} from '../authorizationProfile';
import {
  adjusterNetwork,
  canonicalOriginForChannel,
  trustedPushEnvironment,
  trustedUpdateChannel,
} from '../adjusterNetworkConfig';

const readSource = (...segments) =>
  fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');

// A SiteManager built without its constructor: the authorization binding logic
// under test must not depend on storage load, key generation, or device state.
function authManager(activeSite) {
  const manager = Object.create(SiteManager.prototype);
  manager.sites = [];
  manager.activeSite = activeSite || null;
  manager.customScheme = 'adjusternetwork';
  manager.urlScheme = AUTH_REDIRECT;
  manager._nonce = null;
  manager._nonceSite = null;
  manager.save = jest.fn();
  manager._onChange = jest.fn();
  return manager;
}

const CLIENT_ID = 'synthetic-client-id';

function authorizationProfile(clientId = CLIENT_ID) {
  return {
    profile_id: AUTHORIZATION_PROFILE_ID,
    client_id: clientId,
    exact_match: true,
    granted_scopes: [...REQUIRED_AUTHORIZATION_SCOPES],
    required_scopes: [...REQUIRED_AUTHORIZATION_SCOPES],
  };
}

function memberSite(url, clientId = CLIENT_ID) {
  return {
    url,
    clientId,
    authToken: null,
    credentialRetired: false,
    logoff: jest.fn(),
    refresh: jest.fn(() => Promise.resolve()),
    // A fresh authorization is only accepted after the server confirms the
    // profile is bound to this client ID.
    jsonApi: jest.fn(() => Promise.resolve(authorizationProfile(clientId))),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('native authorization starts in a fresh browser-auth context', () => {
  test('every authorization launches an ephemeral session', async () => {
    SafariWebAuth.requestAuth.mockResolvedValueOnce(
      `${AUTH_REDIRECT}?payload=opaque`,
    );

    await requestIOSAuth(
      'https://adjusternetwork.org/user-api-key/new',
      'adjusternetwork',
    );

    expect(EPHEMERAL_AUTH_SESSION).toBe(true);
    expect(SafariWebAuth.requestAuth).toHaveBeenCalledWith(
      'https://adjusternetwork.org/user-api-key/new',
      'adjusternetwork',
      true,
    );
  });

  test('the SiteManager call site cannot opt out of the ephemeral session', async () => {
    const site = memberSite('https://adjusternetwork.org');
    const manager = authManager(site);
    SafariWebAuth.requestAuth.mockResolvedValueOnce(AUTH_REDIRECT);

    await manager.requestAuth('https://adjusternetwork.org/user-api-key/new');

    expect(SafariWebAuth.requestAuth.mock.calls[0][2]).toBe(true);
  });

  test('no source path can request a persistent shared-Safari session', () => {
    const sessionSource = readSource('iosAuthSession.js');
    const managerSource = readSource('site_manager.js');

    // The flag is a module constant, never a caller-supplied argument.
    expect(sessionSource).toContain(
      'export const EPHEMERAL_AUTH_SESSION = true',
    );
    expect(sessionSource).toMatch(
      /requestIOSAuth\(url, callbackScheme\)[\s\S]*EPHEMERAL_AUTH_SESSION/,
    );
    expect(sessionSource).not.toMatch(/ephemeral\s*=\s*false/);
    expect(managerSource).toContain('requestIOSAuth(url, this.customScheme)');
    expect(managerSource).not.toMatch(/requestIOSAuth\([^)]*false/);
  });

  test('the shipped native bridge honours the ephemeral flag on the same interface', () => {
    const nativeSource = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'vendor',
        'react-native-safari-web-auth',
        'ios',
        'SafariWebAuth.mm',
      ),
      'utf8',
    );

    // This JS/native interface is unchanged by the stale-identity fix, which is
    // what keeps the fix inside the existing runtime contract and OTA-eligible.
    expect(nativeSource).toContain('ephemeral:(BOOL)ephemeral');
    expect(nativeSource).toContain(
      'session.prefersEphemeralWebBrowserSession = ephemeral;',
    );
  });
});

describe('a prior account cannot bind a subsequent authorization', () => {
  test('a replayed prior-account payload is rejected and binds nothing', async () => {
    const accountA = memberSite('https://adjusternetwork.org');
    const manager = authManager(accountA);
    manager._nonceSite = accountA;
    manager._nonce = 'nonce-a';
    manager.decryptHelper = jest.fn(() =>
      JSON.stringify({ nonce: 'nonce-a', key: 'qa-test-key' }),
    );

    await expect(manager.handleAuthPayload('payload-a')).resolves.toBe(true);
    expect(accountA.authToken).toBe('qa-test-key');

    // The pending attempt is one-shot. Replaying the same prior-account
    // callback after it is consumed must not rebind anything.
    const later = memberSite('https://adjusternetwork.org');
    const secondAttempt = authManager(later);
    secondAttempt.decryptHelper = jest.fn(() =>
      JSON.stringify({ nonce: 'nonce-a', key: 'qa-test-key' }),
    );

    await expect(secondAttempt.handleAuthPayload('payload-a')).resolves.toBe(
      false,
    );
    expect(later.authToken).toBeNull();
  });

  test('a callback whose nonce does not match this attempt is rejected', async () => {
    const accountB = memberSite('https://adjusternetwork.org');
    const manager = authManager(accountB);
    manager._nonceSite = accountB;
    manager._nonce = 'nonce-b';
    manager.decryptHelper = jest.fn(() =>
      JSON.stringify({ nonce: 'nonce-a', key: 'qa-test-key' }),
    );

    await expect(manager.handleAuthPayload('stale')).resolves.toBe(false);
    expect(accountB.authToken).toBeNull();
    expect(credentialStore.storeSiteToken).not.toHaveBeenCalled();
  });

  test('a rejected payload fails the authorization instead of silently continuing', async () => {
    const site = memberSite('https://adjusternetwork.org');
    const manager = authManager(site);
    manager._nonceSite = site;
    manager._nonce = 'nonce-b';
    manager.decryptHelper = jest.fn(() =>
      JSON.stringify({ nonce: 'nonce-a', key: 'qa-test-key' }),
    );
    SafariWebAuth.requestAuth.mockResolvedValueOnce(
      `${AUTH_REDIRECT}?payload=stale`,
    );

    await expect(
      manager.requestAuth('https://adjusternetwork.org/user-api-key/new'),
    ).rejects.toThrow('auth_payload_rejected');
    expect(site.authToken).toBeNull();
  });
});

describe('signing in as account B binds the User API key to B', () => {
  test('the key is stored against the site of the pending attempt only', async () => {
    const accountA = memberSite('https://adjusternetwork.org');
    accountA.authToken = 'account-a-key';
    const accountB = memberSite('https://adjusternetwork.org');
    const manager = authManager(accountB);
    manager.sites = [accountA, accountB];
    manager._nonceSite = accountB;
    manager._nonce = 'nonce-b';
    manager.decryptHelper = jest.fn(() =>
      JSON.stringify({
        nonce: 'nonce-b',
        key: 'account-b-key',
        push: false,
        api: 2,
      }),
    );

    await expect(manager.handleAuthPayload('payload-b')).resolves.toBe(true);

    expect(accountB.authToken).toBe('account-b-key');
    expect(accountA.authToken).toBe('account-a-key');
    expect(credentialStore.storeSiteToken).toHaveBeenCalledWith(
      'https://adjusternetwork.org',
      'account-b-key',
    );
  });
});

describe('the authorization callback stays on the governed redirect', () => {
  test('only the Adjuster Network redirect is accepted', () => {
    expect(AUTH_REDIRECT).toBe(
      'adjusternetwork://adjusternetwork.org/auth_redirect',
    );
    expect(isSafeAuthCallback(AUTH_REDIRECT)).toBe(true);
    expect(isSafeAuthCallback(`${AUTH_REDIRECT}?payload=opaque`)).toBe(true);

    for (const hostile of [
      'evil://adjusternetwork.org/auth_redirect?payload=x',
      'adjusternetwork://adjusternetwork.org/auth_redirect.evil?payload=x',
      'adjusternetwork://evil.example.com/auth_redirect?payload=x',
      // The pre-hardening unqualified redirect is no longer accepted.
      'adjusternetwork://auth_redirect?payload=x',
      'https://adjusternetwork.org/auth_redirect?payload=x',
      'about:blank',
    ]) {
      expect(isSafeAuthCallback(hostile)).toBe(false);
    }
  });

  test('an unapproved callback from the ephemeral session is refused', async () => {
    SafariWebAuth.requestAuth.mockResolvedValueOnce(
      'evil://auth_redirect?payload=x',
    );
    await expect(
      requestIOSAuth('https://adjusternetwork.org/auth', 'adjusternetwork'),
    ).rejects.toThrow('auth_callback_invalid');
  });

  test('the authorization request keeps the governed redirect contract', () => {
    const managerSource = readSource('site_manager.js');
    expect(managerSource).toContain('urlScheme = AUTH_REDIRECT');
    expect(managerSource).toContain('auth_redirect: this.urlScheme');
  });
});

describe('environment resolution is unchanged and fail-closed', () => {
  test('only the two governed channels resolve an origin', () => {
    expect(adjusterNetwork.canonicalOrigin).toBe('https://adjusternetwork.org');
    expect(canonicalOriginForChannel('production')).toBe(
      'https://adjusternetwork.org',
    );
    expect(canonicalOriginForChannel('staging')).toBe(
      'https://staging.adjusternetwork.org',
    );
    for (const untrusted of [null, undefined, '', 'preview', 'PRODUCTION']) {
      expect(trustedUpdateChannel(untrusted)).toBeNull();
      expect(canonicalOriginForChannel(untrusted)).toBeNull();
    }
  });

  test('push environment resolution stays iOS-only and fail-closed', () => {
    expect(trustedPushEnvironment('ios', 'production')).toBe('production');
    expect(trustedPushEnvironment('ios', 'staging')).toBe('staging');
    expect(trustedPushEnvironment('ios', 'preview')).toBeNull();
    expect(trustedPushEnvironment('ios', undefined)).toBeNull();
    expect(trustedPushEnvironment('android', 'production')).toBeNull();
  });

  test('authorization refuses a site outside the resolved canonical origin', async () => {
    const manager = authManager(null);
    await expect(
      manager.generateAuthURL({ url: 'https://evil.example.com' }),
    ).rejects.toThrow('auth_origin_not_allowed');
    await expect(manager.generateAuthURL(null)).rejects.toThrow(
      'auth_origin_not_allowed',
    );
  });
});

describe('an account switch retires every client-side identity carrier', () => {
  test('cookies, Keychain token, RSA material, profile and client ID are cleared', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const CookieManager = require('@react-native-cookies/cookies');
    const site = memberSite('https://adjusternetwork.org');
    site.authToken = 'qa-test-key';
    const manager = authManager(site);
    manager.sites = [site];
    manager.clientId = CLIENT_ID;
    manager.rsaKeys = { public: 'pub', private: 'priv' };
    manager._nonce = 'nonce';
    manager._nonceSite = site;

    await manager.resetAuthorizationIdentity();

    // The browser cookie jar and every stored credential carrier are gone.
    expect(CookieManager.clearAll).toHaveBeenCalledWith(true);
    expect(credentialStore.removeSiteToken).toHaveBeenCalledWith(
      'https://adjusternetwork.org',
    );
    expect(credentialStore.removeRSAKeys).toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@ClientId');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@Discourse.rsaKeys');

    // In-memory authorization state cannot survive the switch either.
    expect(manager.rsaKeys).toBeNull();
    expect(manager.clientId).toBeNull();
    expect(manager._nonce).toBeNull();
    expect(manager._nonceSite).toBeNull();
    expect(site.logoff).toHaveBeenCalled();
  });

  test('a failing carrier never aborts the switch', async () => {
    const CookieManager = require('@react-native-cookies/cookies');
    CookieManager.clearAll.mockRejectedValueOnce(new Error('cookie failure'));
    credentialStore.removeRSAKeys.mockRejectedValueOnce(new Error('keychain'));
    const site = memberSite('https://adjusternetwork.org');
    const manager = authManager(site);
    manager.sites = [site];
    manager.clientId = CLIENT_ID;

    await expect(manager.resetAuthorizationIdentity()).resolves.toBeUndefined();
    expect(manager.clientId).toBeNull();
  });

  test('the next authorization after a switch still launches ephemerally', async () => {
    const site = memberSite('https://adjusternetwork.org');
    const manager = authManager(site);
    manager.sites = [site];
    manager.clientId = CLIENT_ID;
    await manager.resetAuthorizationIdentity();

    SafariWebAuth.requestAuth.mockResolvedValueOnce(AUTH_REDIRECT);
    await manager.requestAuth('https://adjusternetwork.org/user-api-key/new');

    expect(SafariWebAuth.requestAuth.mock.calls[0][2]).toBe(true);
  });
});
