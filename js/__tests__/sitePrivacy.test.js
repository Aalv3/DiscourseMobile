import Site from '../site';
import fetch from '../../lib/fetch';

jest.mock('../../lib/fetch', () => jest.fn());

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

  test('relaunch and logout/login preserve the authorization-bound client ID', () => {
    const original = new Site({
      url: 'https://adjusternetwork.org',
      authToken: 'first-key',
      clientId: 'auth-client-A',
    });
    const relaunched = new Site(original.toJSON());

    expect(relaunched.clientId).toBe('auth-client-A');
    relaunched.logoff();
    relaunched.authToken = 'second-key';
    expect(relaunched.clientId).toBe('auth-client-A');
  });

  test('first authenticated request sends the authorization-bound client ID', async () => {
    fetch.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });
    const site = new Site({
      url: 'https://adjusternetwork.org',
      authToken: 'synthetic-key',
      clientId: 'auth-client-A',
    });

    await expect(site.jsonApi('/session/current.json')).resolves.toEqual({
      ok: true,
    });
    expect(fetch.mock.calls[0][0].headers.get('User-Api-Client-Id')).toBe(
      'auth-client-A',
    );
  });
});
