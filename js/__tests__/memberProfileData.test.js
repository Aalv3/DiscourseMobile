import { loadMemberProfileData } from '../product/memberProfileData';

describe('native member profile data', () => {
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
});
