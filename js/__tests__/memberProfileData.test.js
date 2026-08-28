import {
  cachedMemberProfileData,
  clearMemberProfileDataCache,
  loadMemberProfileData,
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

  test('bounds a profile request that never settles', async () => {
    jest.useFakeTimers();
    const site = {
      url: 'https://staging.example',
      username: 'qa_test',
      jsonApi: jest.fn(() => new Promise(() => {})),
    };
    const pending = loadMemberProfileData(site, 'qa_test', 25);
    const failure = expect(pending).rejects.toMatchObject({
      code: 'profile_load_timeout',
    });
    await jest.advanceTimersByTimeAsync(25);
    await failure;
    jest.useRealTimers();
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
});
