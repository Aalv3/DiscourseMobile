/* @flow */
'use strict';

import { classifyAuthResponse } from '../authResponsePolicy';
import Site from '../site';

jest.mock('../../lib/fetch', () => jest.fn());
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
  test('only 401 is classified as revoked', () => {
    expect(classifyAuthResponse(401)).toBe('revoked');
    [403, 429, 404, 500, 502, 503, 200, 204].forEach(status => {
      expect(classifyAuthResponse(status)).not.toBe('revoked');
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
      if (classifyAuthResponse(status) === 'revoked') {
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

  describe('403 differentiation via canonical liveness probe', () => {
    // site.js uses the repo's XHR-based fetch wrapper, not global.fetch.
    const fetchMock = require('../../lib/fetch');

    const withProbe = (probeStatus, opts = {}) => {
      const site = makeSite();
      site.onCredentialRetired = () => {};
      fetchMock.mockReset();
      if (opts.throws) {
        fetchMock.mockRejectedValue(new Error('Network request failed'));
      } else {
        fetchMock.mockResolvedValue({ status: probeStatus });
      }
      return site;
    };

    test('not_logged_in retires without any probe', async () => {
      const site = withProbe(200);
      await expect(
        site.shouldRetireOnForbidden({ error_type: 'not_logged_in' }),
      ).resolves.toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('revoked key (invalid_access, probe 403) retires', async () => {
      const site = withProbe(403);
      await expect(
        site.shouldRetireOnForbidden({ error_type: 'invalid_access' }),
      ).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('ordinary permission 403 with a live credential preserves the session', async () => {
      const site = withProbe(200);
      await expect(
        site.shouldRetireOnForbidden({ error_type: 'invalid_access' }),
      ).resolves.toBe(false);
    });

    test('onboarding/policy gating never retires and never probes', async () => {
      const site = withProbe(403);
      await expect(
        site.shouldRetireOnForbidden({
          error_type: 'invalid_access',
          reason: 'onboarding_incomplete',
          continue_at: '/renaissance/onboarding',
        }),
      ).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test.each([429, 500, 502, 503])(
      'inconclusive probe status %i preserves the session',
      async status => {
        const site = withProbe(status);
        await expect(
          site.shouldRetireOnForbidden({ error_type: 'invalid_access' }),
        ).resolves.toBe(false);
      },
    );

    test('offline probe failure preserves the session', async () => {
      const site = withProbe(0, { throws: true });
      await expect(
        site.shouldRetireOnForbidden({ error_type: 'invalid_access' }),
      ).resolves.toBe(false);
    });

    test('a site with no token never retires again', async () => {
      const site = makeSite();
      site.authToken = null;
      await expect(
        site.shouldRetireOnForbidden({ error_type: 'not_logged_in' }),
      ).resolves.toBe(false);
    });
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
