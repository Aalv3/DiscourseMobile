import { memberImageSource } from '../product/memberImageSource';

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
