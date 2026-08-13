import Site from '../site';

describe('site privacy serialization', () => {
  test('never serializes the user API key into AsyncStorage metadata', () => {
    const site = new Site({
      url: 'https://adjusternetwork.org',
      authToken: 'synthetic-secret',
      username: 'synthetic-user',
    });
    expect(site.toJSON()).not.toHaveProperty('authToken');
    expect(JSON.stringify(site)).not.toContain('synthetic-secret');
  });

  test('persists the non-secret User API client identifier', () => {
    const site = new Site({
      url: 'https://adjusternetwork.org',
      clientId: 'synthetic-client-id',
    });

    expect(site.toJSON()).toHaveProperty('clientId', 'synthetic-client-id');
  });
});
