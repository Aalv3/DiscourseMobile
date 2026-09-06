import {
  authenticatedOriginHeaders,
  memberImageSource,
} from '../product/memberImageSource';

const CANONICAL = 'https://adjusternetwork.org';
const site = { url: CANONICAL, authToken: 'user-api-key', clientId: 'client' };

describe('authenticated member image requests', () => {
  test('attaches the User API credential for the governed origin', () => {
    const source = memberImageSource(
      site,
      `${CANONICAL}/renaissance/member-photo/tomrodriguez/120/7`,
    );

    expect(source).toEqual({
      uri: `${CANONICAL}/renaissance/member-photo/tomrodriguez/120/7`,
      headers: {
        'User-Api-Key': 'user-api-key',
        'User-Api-Client-Id': 'client',
      },
    });
  });

  test('never sends the credential to any other host', () => {
    for (const uri of [
      'https://evil.example.com/renaissance/member-photo/tomrodriguez/120/7',
      'https://adjusternetwork.org.evil.example.com/a.png',
      'https://cdn.adjusternetwork.org/a.png',
      'https://staging.adjusternetwork.org/renaissance/member-photo/x/120/7',
      'https://www.gravatar.com/avatar/abc.png',
    ]) {
      expect(memberImageSource(site, uri)).toEqual({ uri });
    }
  });

  test('never sends the credential over plain HTTP', () => {
    const uri = 'http://adjusternetwork.org/renaissance/member-photo/x/120/7';
    expect(memberImageSource(site, uri)).toEqual({ uri });
  });

  test('a signed-out viewer sends no credential', () => {
    const uri = `${CANONICAL}/renaissance/member-photo/tomrodriguez/120/7`;
    expect(memberImageSource({ url: CANONICAL }, uri)).toEqual({ uri });
    expect(memberImageSource(null, uri)).toEqual({ uri });
    expect(memberImageSource({ ...site, authToken: null }, uri)).toEqual({
      uri,
    });
  });

  test('no credential ever reaches the URL, query string or cache key', () => {
    const source = memberImageSource(
      site,
      `${CANONICAL}/renaissance/member-photo/tomrodriguez/120/7`,
    );
    expect(source.uri).not.toContain('user-api-key');
    expect(source.uri).not.toContain('User-Api-Key');
    expect(source.uri).toBe(
      `${CANONICAL}/renaissance/member-photo/tomrodriguez/120/7`,
    );
    expect(source.uri.includes('?')).toBe(false);
  });

  test('a missing URL yields no source so the letter avatar renders', () => {
    expect(memberImageSource(site, null)).toBeNull();
    expect(memberImageSource(site, '')).toBeNull();
    expect(memberImageSource(site, undefined)).toBeNull();
  });

  test('a missing client id still sends a well-formed header pair', () => {
    const source = memberImageSource(
      { url: CANONICAL, authToken: 'key' },
      `${CANONICAL}/renaissance/member-photo/x/120/7`,
    );
    expect(source.headers['User-Api-Client-Id']).toBe('');
    expect(source.headers['User-Api-Key']).toBe('key');
  });
});

describe('the shared Avatar is the only member-photo loader', () => {
  const fs = require('fs');
  const path = require('path');
  const read = file =>
    fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

  test('Avatar routes its image through the authenticated source', () => {
    const source = read('product/ProductComponents.js');
    expect(source).toContain('memberImageSource(site, resolvedUri)');
    // The unauthenticated form must not survive anywhere in the component.
    expect(source).not.toContain('source={{ uri: resolvedUri }}');
    expect(source).toContain('export const MemberAvatar = Avatar');
  });

  test('an account switch clears every cached avatar record', () => {
    const source = read('site_manager.js');
    const reset = source.slice(
      source.indexOf('async resetAuthorizationIdentity'),
      source.indexOf('setActiveSite(site)'),
    );
    expect(reset).toContain('clearAvatarAuthorities()');
    // Logout already clears the per-site records.
    expect(source).toContain('clearAvatarAuthorityForSite(removableSite)');
  });
});

describe('adversarial origins never receive the User API credential', () => {
  // Post cooked HTML is member-authored, so a hostile absolute URL can reach
  // the media loader directly. Every one of these must come back bare.
  const HOSTILE = [
    'https://evil.example.com/uploads/a.png',
    'https://adjusternetwork.org.evil.example.com/uploads/a.png',
    'https://evil.example.com/?next=https://adjusternetwork.org/uploads/a.png',
    'https://evil.example.com#https://adjusternetwork.org/uploads/a.png',
    'https://cdn.adjusternetwork.org/uploads/a.png',
    'https://staging.adjusternetwork.org/uploads/a.png',
    'https://adjusternetwork.org.example.com/uploads/a.png',
    'https://adjusternetwork.orgevil.com/uploads/a.png',
    'http://adjusternetwork.org/uploads/a.png',
    'http://evil.example.com/uploads/a.png',
    'https://user:pass@evil.example.com/uploads/a.png',
    'https://adjusternetwork.org:8443/uploads/a.png',
    'ftp://adjusternetwork.org/uploads/a.png',
    'file:///etc/passwd',
    'data:image/png;base64,AAAA',
    'javascript:alert(1)',
    '//evil.example.com/uploads/a.png',
  ];

  test.each(HOSTILE)('no credential for %s', uri => {
    expect(authenticatedOriginHeaders(site, uri)).toBeUndefined();
    expect(memberImageSource(site, uri)).toEqual({ uri });
  });

  test('the trusted origin still authenticates for both surfaces', () => {
    for (const uri of [
      `${CANONICAL}/renaissance/member-photo/tomrodriguez/120/7`,
      `${CANONICAL}/secure-uploads/original/1X/abc.png`,
      `${CANONICAL}/uploads/default/original/1X/abc.png`,
    ]) {
      expect(authenticatedOriginHeaders(site, uri)).toEqual({
        'User-Api-Key': 'user-api-key',
        'User-Api-Client-Id': 'client',
      });
    }
  });

  test('a signed-out or missing viewer never authenticates', () => {
    const uri = `${CANONICAL}/secure-uploads/original/1X/abc.png`;
    expect(authenticatedOriginHeaders(null, uri)).toBeUndefined();
    expect(authenticatedOriginHeaders({ url: CANONICAL }, uri)).toBeUndefined();
    expect(authenticatedOriginHeaders(site, null)).toBeUndefined();
    expect(authenticatedOriginHeaders(site, '')).toBeUndefined();
  });
});

describe('secure media reuses the same origin guard', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'product', 'DiscourseMedia.js'),
    'utf8',
  );

  test('media images and the attachment viewer are both guarded', () => {
    expect(source).toContain(
      'const headers = authenticatedOriginHeaders(site, state.url)',
    );
    expect(source).toContain(
      'const headers = authenticatedOriginHeaders(site, state.authorizedUrl)',
    );
  });

  test('no unguarded credential construction remains anywhere', () => {
    // The only place these header names may appear is the guarded helper.
    expect(source).not.toContain("'User-Api-Key': site.authToken");
    const helper = fs.readFileSync(
      path.join(__dirname, '..', 'product', 'memberImageSource.js'),
      'utf8',
    );
    expect(helper).toContain('isCanonicalUrl(uri)');
    const components = fs.readFileSync(
      path.join(__dirname, '..', 'product', 'ProductComponents.js'),
      'utf8',
    );
    expect(components).not.toContain("'User-Api-Key'");
  });
});
