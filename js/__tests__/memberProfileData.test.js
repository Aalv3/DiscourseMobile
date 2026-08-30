import {
  cachedMemberProfileData,
  clearMemberProfileDataCache,
  loadMemberProfileData,
  removeCachedMemberProfileAvatar,
  updateCachedMemberProfileAvatar,
} from '../product/memberProfileData';

describe('native member profile data', () => {
  beforeEach(() => clearMemberProfileDataCache());

  test('renders a legitimate sparse member from the canonical member card', async () => {
    const site = {
      username: 'qa_test',
      jsonApi: jest.fn(path => {
        if (path === '/u/sparse_member.json') {
          return Promise.resolve({ user: { username: 'sparse_member' } });
        }
        if (path.startsWith('/user_actions.json')) {
          return Promise.resolve({ user_actions: [] });
        }
        if (path === '/native/v1/profiles/sparse_member') {
          return Promise.resolve({
            schema: 'an.adjuster-card.v2',
            schema_version: 2,
            core: { name: 'Sparse Member', bio: '' },
            fields: {},
            enabled_fields: [],
            capabilities: { photo: { enabled: true } },
            editable: false,
          });
        }
        return Promise.reject(
          Object.assign(new Error('not enabled'), { status: 404 }),
        );
      }),
    };
    await expect(loadMemberProfileData(site, 'sparse_member')).resolves.toEqual(
      {
        profile: { user: { username: 'sparse_member' } },
        activity: { user_actions: [] },
        cardPayload: expect.objectContaining({
          schema: 'an.adjuster-card.v2',
        }),
      },
    );
  });

  test('keeps the core member profile authoritative', async () => {
    const site = {
      username: 'qa_test',
      jsonApi: jest.fn(() => Promise.reject(new Error('offline'))),
    };
    await expect(loadMemberProfileData(site, 'qa_test')).rejects.toThrow(
      'offline',
    );
  });

  test('does not wrap cooldown-aware requests in an aggregate timer', async () => {
    const site = {
      url: 'https://staging.example',
      username: 'qa_test',
      jsonApi: jest.fn(path => {
        if (path === '/native/v1/profile') {
          return Promise.resolve({ schema: 'an.adjuster-card.v2' });
        }
        return Promise.resolve(
          path.startsWith('/user_actions')
            ? { user_actions: [] }
            : { user: { username: 'qa_test' } },
        );
      }),
    };
    await expect(loadMemberProfileData(site, 'qa_test')).resolves.toEqual(
      expect.objectContaining({
        cardPayload: { schema: 'an.adjuster-card.v2' },
      }),
    );
    expect(site.jsonApi).toHaveBeenCalledTimes(2);
    expect(site.jsonApi).not.toHaveBeenCalledWith(
      expect.stringContaining('/user_actions.json'),
    );
  });

  test('retains last-known profile data after a failed refresh', async () => {
    const site = {
      url: 'https://staging.example',
      username: 'qa_test',
      jsonApi: jest.fn(path => {
        if (path === '/u/qa_test.json') {
          return Promise.resolve({ user: { username: 'qa_test' } });
        }
        if (path.startsWith('/user_actions.json')) {
          return Promise.resolve({ user_actions: [] });
        }
        return Promise.resolve({
          schema: 'an.adjuster-card.v2',
          schema_version: 2,
          core: { name: 'Cached Member' },
        });
      }),
    };
    const first = await loadMemberProfileData(site, 'qa_test');
    expect(cachedMemberProfileData(site, 'qa_test')).toBe(first);

    site.jsonApi.mockRejectedValue(new Error('offline'));
    await expect(loadMemberProfileData(site, 'qa_test')).rejects.toThrow(
      'offline',
    );
    expect(cachedMemberProfileData(site, 'qa_test')).toBe(first);
  });

  test('makes a successfully uploaded avatar authoritative in cached data', async () => {
    const site = {
      url: 'https://staging.example',
      username: 'qa_test',
      jsonApi: jest.fn(path => {
        if (path === '/u/qa_test.json') {
          return Promise.resolve({
            user: { username: 'qa_test', avatar_template: '/old/{size}.png' },
          });
        }
        if (path.startsWith('/user_actions.json')) {
          return Promise.resolve({ user_actions: [] });
        }
        return Promise.resolve({
          schema: 'an.adjuster-card.v2',
          core: { avatar_template: '/old/{size}.png' },
        });
      }),
    };
    await loadMemberProfileData(site, 'qa_test');
    updateCachedMemberProfileAvatar(site, 'qa_test', '/new/{size}.png');
    expect(cachedMemberProfileData(site, 'qa_test')).toMatchObject({
      profile: { user: { avatar_template: '/new/{size}.png' } },
      cardPayload: { core: { avatar_template: '/new/{size}.png' } },
    });
  });

  test('rejects a stale profile response that settles after avatar upload', async () => {
    let resolveProfile;
    let resolveCard;
    const site = {
      url: 'https://staging.example',
      username: 'qa_test',
      jsonApi: jest.fn(path =>
        path === '/u/qa_test.json'
          ? new Promise(resolve => {
              resolveProfile = resolve;
            })
          : new Promise(resolve => {
              resolveCard = resolve;
            }),
      ),
    };
    const staleLoad = loadMemberProfileData(site, 'qa_test');
    updateCachedMemberProfileAvatar(site, 'qa_test', '/new/{size}.png');
    resolveProfile({
      user: { username: 'qa_test', avatar_template: '/old/{size}.png' },
    });
    resolveCard({
      schema: 'an.adjuster-card.v2',
      core: { avatar_template: '/old/{size}.png' },
    });

    await expect(staleLoad).resolves.toMatchObject({
      profile: { user: { avatar_template: '/new/{size}.png' } },
      cardPayload: { core: { avatar_template: '/new/{size}.png' } },
    });
    expect(cachedMemberProfileData(site, 'qa_test')).toMatchObject({
      cardPayload: { core: { avatar_template: '/new/{size}.png' } },
    });
  });

  test('photo removal clears both cached profile representations', async () => {
    const site = {
      url: 'https://staging.example',
      username: 'qa_test',
      jsonApi: jest.fn(path =>
        Promise.resolve(
          path === '/u/qa_test.json'
            ? {
                user: {
                  username: 'qa_test',
                  avatar_template: '/old/{size}.png',
                },
              }
            : {
                schema: 'an.adjuster-card.v2',
                core: { avatar_template: '/old/{size}.png' },
              },
        ),
      ),
    };
    await loadMemberProfileData(site, 'qa_test');
    removeCachedMemberProfileAvatar(site, 'qa_test');
    expect(cachedMemberProfileData(site, 'qa_test')).toMatchObject({
      profile: { user: { avatar_template: '' } },
      cardPayload: { core: { avatar_template: '' } },
    });
  });

  test('remount after upload and PATCH failure keeps avatar until a fresh GET confirms it', async () => {
    let avatar = '/old/{size}.png';
    const site = {
      url: 'https://staging.example',
      username: 'qa_test',
      jsonApi: jest.fn(path =>
        Promise.resolve(
          path === '/u/qa_test.json'
            ? { user: { username: 'qa_test', avatar_template: avatar } }
            : {
                schema: 'an.adjuster-card.v2',
                core: { avatar_template: avatar },
              },
        ),
      ),
    };
    await loadMemberProfileData(site, 'qa_test');
    updateCachedMemberProfileAvatar(site, 'qa_test', '/new/{size}.png');

    await loadMemberProfileData(site, 'qa_test');
    expect(cachedMemberProfileData(site, 'qa_test')).toMatchObject({
      cardPayload: { core: { avatar_template: '/new/{size}.png' } },
    });

    avatar = '/new/{size}.png';
    await loadMemberProfileData(site, 'qa_test');
    expect(cachedMemberProfileData(site, 'qa_test')).toMatchObject({
      profile: { user: { avatar_template: '/new/{size}.png' } },
      cardPayload: { core: { avatar_template: '/new/{size}.png' } },
    });
  });
});
