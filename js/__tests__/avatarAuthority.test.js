import {
  avatarAuthoritySnapshot,
  captureAvatarAuthorityVersion,
  clearAvatarAuthorities,
  clearAvatarAuthorityForSite,
  publishAvatarAuthority,
  reconcileAvatarAuthority,
  subscribeAvatarAuthority,
} from '../product/avatarAuthority';

describe('shared avatar authority', () => {
  const site = { url: 'https://staging.example' };

  beforeEach(() => clearAvatarAuthorities());

  test('profile upload updates mounted consumers immediately without a refetch', () => {
    const updates = [];
    const unsubscribe = subscribeAvatarAuthority(site, 'member', () => {
      updates.push(avatarAuthoritySnapshot(site, 'member')?.template);
    });
    publishAvatarAuthority(site, 'member', '/new/{size}.png');

    expect(updates).toEqual(['/new/{size}.png']);
    expect(avatarAuthoritySnapshot(site, 'member')).toMatchObject({
      template: '/new/{size}.png',
      confirmed: false,
    });
    unsubscribe();
  });

  test('back navigation reads the same authority without another request', () => {
    publishAvatarAuthority(site, 'member', '/new/{size}.png');
    expect(avatarAuthoritySnapshot(site, 'member')?.template).toBe(
      '/new/{size}.png',
    );
  });

  test('a stale GET cannot overwrite a newer upload', () => {
    reconcileAvatarAuthority(site, 'member', '/old/{size}.png', 0);
    const staleVersion = captureAvatarAuthorityVersion(site, 'member');
    publishAvatarAuthority(site, 'member', '/new/{size}.png');

    expect(
      reconcileAvatarAuthority(site, 'member', '/old/{size}.png', staleVersion),
    ).toBe('/new/{size}.png');
  });

  test('a later server response confirms the uploaded avatar', () => {
    publishAvatarAuthority(site, 'member', '/new/{size}.png');
    const version = captureAvatarAuthorityVersion(site, 'member');

    expect(
      reconcileAvatarAuthority(site, 'member', '/new/{size}.png', version),
    ).toBe('/new/{size}.png');
    expect(avatarAuthoritySnapshot(site, 'member')?.confirmed).toBe(true);
  });

  test('a confirmed newer server value can replace current authority', () => {
    publishAvatarAuthority(site, 'member', '/uploaded/{size}.png');
    let version = captureAvatarAuthorityVersion(site, 'member');
    reconcileAvatarAuthority(site, 'member', '/uploaded/{size}.png', version);
    version = captureAvatarAuthorityVersion(site, 'member');

    expect(
      reconcileAvatarAuthority(
        site,
        'member',
        '/server-newer/{size}.png',
        version,
      ),
    ).toBe('/server-newer/{size}.png');
  });

  test('site and user scopes do not leak and logout clears the site', () => {
    const otherSite = { url: 'https://other.example' };
    publishAvatarAuthority(site, 'member', '/member/{size}.png');
    publishAvatarAuthority(site, 'other', '/other-user/{size}.png');
    publishAvatarAuthority(otherSite, 'member', '/other-site/{size}.png');

    expect(avatarAuthoritySnapshot(site, 'other')?.template).toBe(
      '/other-user/{size}.png',
    );
    clearAvatarAuthorityForSite(site);

    expect(avatarAuthoritySnapshot(site, 'member')).toBeNull();
    expect(avatarAuthoritySnapshot(site, 'other')).toBeNull();
    expect(avatarAuthoritySnapshot(otherSite, 'member')?.template).toBe(
      '/other-site/{size}.png',
    );
  });
});
