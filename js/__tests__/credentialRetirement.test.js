/* @flow */
'use strict';

import {
  classifyAuthResponse,
  INVALID_USER_API_CREDENTIAL,
} from '../authResponsePolicy';
import Site from '../site';

jest.mock('../secureCredentialStore', () => ({
  credentialStore: {
    removeSiteToken: jest.fn().mockResolvedValue(undefined),
    storeSiteToken: jest.fn().mockResolvedValue(undefined),
    readSiteToken: jest.fn().mockResolvedValue(null),
  },
}));

const makeSite = () =>
  new Site({
    url: 'https://adjusternetwork.org',
    title: 'Adjuster Network',
    apiVersion: 4,
    authToken: 'live-token',
  });

describe('authoritative credential retirement', () => {
  test('only the canonical server credential tuple is classified as revoked', () => {
    const canonical = {
      error_type: INVALID_USER_API_CREDENTIAL.errorType,
      reason: INVALID_USER_API_CREDENTIAL.reason,
    };
    expect(classifyAuthResponse(401, canonical)).toBe('revoked');
    expect(classifyAuthResponse(401, null)).not.toBe('revoked');
    expect(
      classifyAuthResponse(401, { error_type: canonical.error_type }),
    ).not.toBe('revoked');
    expect(classifyAuthResponse(403, canonical)).toBe('forbidden');
    [403, 429, 404, 500, 502, 503, 200, 204].forEach(status => {
      expect(classifyAuthResponse(status, canonical)).not.toBe('revoked');
    });
  });

  test('retireCredential clears the token and notifies the manager once', () => {
    const site = makeSite();
    const seen = [];
    site.onCredentialRetired = (retired, reason) =>
      seen.push([retired.url, reason]);

    site.retireCredential('revoked');
    expect(site.authToken).toBeNull();
    expect(site.credentialRetired).toBe(true);
    expect(seen).toEqual([['https://adjusternetwork.org', 'revoked']]);

    // Idempotent: a second authoritative failure must not re-notify.
    site.retireCredential('revoked');
    expect(seen).toHaveLength(1);
  });

  test('logoff alone does not mark the credential retired', () => {
    const site = makeSite();
    const seen = [];
    site.onCredentialRetired = () => seen.push('notified');
    site.logoff();
    expect(site.authToken).toBeNull();
    expect(site.credentialRetired).toBeFalsy();
    expect(seen).toHaveLength(0);
  });

  describe('non-authoritative failures never retire the credential', () => {
    test.each([
      ['ordinary authorization 403', 403],
      ['rate limit 429', 429],
      ['not found 404', 404],
      ['server failure 500', 500],
      ['bad gateway 502', 502],
      ['unavailable 503', 503],
    ])('%s preserves the session', (_label, status) => {
      const site = makeSite();
      let notified = false;
      site.onCredentialRetired = () => {
        notified = true;
      };
      if (classifyAuthResponse(status, null) === 'revoked') {
        site.retireCredential('revoked');
      }
      expect(site.authToken).toBe('live-token');
      expect(site.credentialRetired).toBeFalsy();
      expect(notified).toBe(false);
    });

    test('offline/network rejection preserves the session', () => {
      const site = makeSite();
      let notified = false;
      site.onCredentialRetired = () => {
        notified = true;
      };
      // A transport rejection never reaches a status classification at all.
      const error = new Error('Network request failed');
      expect(error.status).toBeUndefined();
      expect(site.authToken).toBe('live-token');
      expect(notified).toBe(false);
    });
  });

  test('a retired site reports as not connected so the root signs out', () => {
    const site = makeSite();
    site.onCredentialRetired = () => {};
    const connected = sites => sites.filter(s => s.authToken).length;
    expect(connected([site])).toBe(1);
    site.retireCredential('revoked');
    // This is exactly the predicate the root navigator uses to choose between
    // the authenticated shell and the signed-out welcome screen.
    expect(connected([site])).toBe(0);
    expect([site].find(s => s.authToken)).toBeUndefined();
  });

  test('a fresh verified authorization clears the retirement latch', () => {
    const site = makeSite();
    site.onCredentialRetired = () => {};
    site.retireCredential('revoked');
    expect(site.credentialRetired).toBe(true);

    // Mirrors handleAuthPayload's post-verification assignment.
    site.authToken = 'new-token';
    site.credentialRetired = false;
    site.credentialRetiredReason = null;
    expect(site.authToken).toBe('new-token');
    expect(site.credentialRetired).toBe(false);
  });
});
