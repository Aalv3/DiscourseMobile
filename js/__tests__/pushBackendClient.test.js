import { PushBackendClient } from '../pushBackendClient';

describe('A3 push backend client', () => {
  test('sends registration only to configured HTTPS A3 endpoint', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve({ status: 204 }));
    const client = new PushBackendClient({
      origin: 'https://push.adjusternetwork.org',
      fetchImpl,
      nonceFactory: () => Promise.resolve('nonce_0123456789abcdef'),
    });
    await client.register({
      installationId: 'install/id',
      authToken: 'synthetic-key',
      authClientId: 'synthetic-client-id',
      registration: {
        platform: 'ios',
        environment: 'staging',
        appId: 'org.adjusternetwork.app',
        transportToken: 'synthetic-token',
      },
    });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://push.adjusternetwork.org/native/v1/push/registrations/install%2Fid',
    );
    expect(fetchImpl.mock.calls[0][1].method).toBe('PUT');
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({
      'User-Api-Key': 'synthetic-key',
      'User-Api-Client-Id': 'synthetic-client-id',
      'X-AN-Push-Nonce': 'nonce_0123456789abcdef',
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      registration: {
        platform: 'ios',
        environment: 'staging',
        app_id: 'org.adjusternetwork.app',
        token: 'synthetic-token',
      },
    });
  });

  test('fails closed without an HTTPS backend', async () => {
    const client = new PushBackendClient({
      origin: null,
      fetchImpl: jest.fn(),
      nonceFactory: () => Promise.resolve('nonce_0123456789abcdef'),
    });
    await expect(
      client.unregister({ installationId: 'id', authToken: 'key' }),
    ).rejects.toMatchObject({
      result: {
        stage: 'backend_transport',
        category: 'backend_rejection',
      },
    });
  });

  test('reports only a rejected HTTP status', async () => {
    const client = new PushBackendClient({
      origin: 'https://adjusternetwork.org',
      fetchImpl: jest.fn(() => Promise.resolve({ status: 403 })),
      nonceFactory: () => Promise.resolve('nonce_0123456789abcdef'),
    });
    await expect(
      client.register({
        installationId: 'id',
        authToken: 'key',
        authClientId: 'client',
        registration: {},
      }),
    ).rejects.toMatchObject({
      result: {
        stage: 'backend_response',
        category: 'backend_rejection',
        httpStatusClass: '4xx',
      },
    });
  });

  test('rejects a non-A3 HTTPS backend', async () => {
    const client = new PushBackendClient({
      origin: 'https://api.discourse.org',
      fetchImpl: jest.fn(),
      nonceFactory: () => Promise.resolve('nonce_0123456789abcdef'),
    });
    await expect(
      client.unregister({ installationId: 'id', authToken: 'key' }),
    ).rejects.toMatchObject({
      result: {
        stage: 'backend_transport',
        category: 'backend_rejection',
      },
    });
  });

  test.each([
    [429, 'backend_rate_limited', '429'],
    [500, 'backend_rejection', '5xx'],
  ])(
    'preserves safe HTTP classification for %s',
    async (status, category, httpStatusClass) => {
      const client = new PushBackendClient({
        origin: 'https://adjusternetwork.org',
        fetchImpl: jest.fn(() => Promise.resolve({ status })),
        nonceFactory: () => Promise.resolve('nonce_0123456789abcdef'),
      });
      await expect(
        client.register({
          installationId: 'id',
          authToken: 'key',
          authClientId: 'client',
          registration: {},
        }),
      ).rejects.toMatchObject({
        result: { stage: 'backend_response', category, httpStatusClass },
      });
    },
  );

  test('distinguishes transport failure from an HTTP rejection', async () => {
    const client = new PushBackendClient({
      origin: 'https://adjusternetwork.org',
      fetchImpl: jest.fn(() => Promise.reject(new TypeError('private'))),
      nonceFactory: () => Promise.resolve('nonce_0123456789abcdef'),
    });
    await expect(
      client.register({
        installationId: 'id',
        authToken: 'key',
        authClientId: 'client',
        registration: {},
      }),
    ).rejects.toMatchObject({
      result: {
        stage: 'backend_transport',
        category: 'network_failure',
        httpStatusClass: 'none',
      },
    });
  });

  test('classifies a rejected nonce generator without exposing its error', async () => {
    const client = new PushBackendClient({
      origin: 'https://adjusternetwork.org',
      fetchImpl: jest.fn(),
      nonceFactory: () => Promise.reject(new Error('private')),
    });
    await expect(
      client.register({
        installationId: 'id',
        authToken: 'key',
        authClientId: 'client',
        registration: {},
      }),
    ).rejects.toMatchObject({
      result: { stage: 'nonce_generation', category: 'nonce_failure' },
    });
  });

  test('fails closed when a fresh request nonce is unavailable', async () => {
    const client = new PushBackendClient({
      origin: 'https://adjusternetwork.org',
      fetchImpl: jest.fn(),
      nonceFactory: () => Promise.resolve('short'),
    });
    await expect(
      client.register({
        installationId: 'id',
        authToken: 'key',
        authClientId: 'client',
        registration: {},
      }),
    ).rejects.toMatchObject({
      result: {
        stage: 'nonce_generation',
        category: 'nonce_failure',
      },
    });
  });
});
