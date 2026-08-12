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
      registration: { platform: 'ios', transportToken: 'synthetic-token' },
    });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://push.adjusternetwork.org/native/v1/push/registrations/install%2Fid',
    );
    expect(fetchImpl.mock.calls[0][1].method).toBe('PUT');
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
