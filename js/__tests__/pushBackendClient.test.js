import { PushBackendClient } from '../pushBackendClient';

describe('A3 push backend client', () => {
  test('sends registration only to configured HTTPS A3 endpoint', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve({ status: 204 }));
    const client = new PushBackendClient({
      origin: 'https://push.adjusternetwork.org',
      fetchImpl,
    });
    await client.register({
      installationId: 'install/id',
      authToken: 'synthetic-key',
      authClientId: 'synthetic-client-id',
      registration: { platform: 'ios', transportToken: 'synthetic-token' },
    });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://push.adjusternetwork.org/native/v1/push/registrations/install%2Fid',
    );
    expect(fetchImpl.mock.calls[0][1].method).toBe('PUT');
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({
      'User-Api-Key': 'synthetic-key',
      'User-Api-Client-Id': 'synthetic-client-id',
    });
  });

  test('fails closed without an HTTPS backend', async () => {
    const client = new PushBackendClient({
      origin: null,
      fetchImpl: jest.fn(),
    });
    await expect(
      client.unregister({ installationId: 'id', authToken: 'key' }),
    ).rejects.toThrow('push_backend_unconfigured');
  });

  test('reports only a rejected HTTP status', async () => {
    const client = new PushBackendClient({
      origin: 'https://adjusternetwork.org',
      fetchImpl: jest.fn(() => Promise.resolve({ status: 403 })),
    });
    await expect(
      client.register({
        installationId: 'id',
        authToken: 'key',
        authClientId: 'client',
        registration: {},
      }),
    ).rejects.toThrow('push_backend_rejected_403');
  });

  test('rejects a non-A3 HTTPS backend', async () => {
    const client = new PushBackendClient({
      origin: 'https://api.discourse.org',
      fetchImpl: jest.fn(),
    });
    await expect(
      client.unregister({ installationId: 'id', authToken: 'key' }),
    ).rejects.toThrow('push_backend_unconfigured');
  });
});
