import { PushFoundation } from '../pushFoundation';

function fixture(permission = 'granted') {
  const store = {
    preference: jest.fn(() => Promise.resolve('unknown')),
    setPreference: jest.fn(() => Promise.resolve()),
    installationId: jest.fn(() => Promise.resolve('installation')),
  };
  let refreshHandler;
  const remove = jest.fn();
  const transport = {
    platform: 'ios',
    permissionState: jest.fn(() => Promise.resolve(permission)),
    requestPermission: jest.fn(() => Promise.resolve(permission)),
    token: jest.fn(() => Promise.resolve('transport-token')),
    onTokenRefresh: jest.fn(handler => {
      refreshHandler = handler;
      return { remove };
    }),
  };
  const client = {
    register: jest.fn(() => Promise.resolve()),
    refresh: jest.fn(() => Promise.resolve()),
    unregister: jest.fn(() => Promise.resolve()),
    updatePreferences: jest.fn(() => Promise.resolve()),
  };
  const foundation = new PushFoundation({
    enabled: true,
    environment: 'staging',
    apsEnvironment: 'development',
    appId: 'org.adjusternetwork.app',
    appVersion: '1.0.0',
    build: '1',
    store,
    transport,
    client,
  });
  return {
    foundation,
    store,
    transport,
    client,
    refresh: token => refreshHandler(token),
    remove,
  };
}

describe('push foundation lifecycle', () => {
  const account = {
    authToken: 'synthetic-user-api-key',
    clientId: 'synthetic-client-id',
  };

  test('default-off mode never asks permission or contacts a backend', async () => {
    const deps = fixture();
    deps.foundation.enabled = false;
    await expect(deps.foundation.enable(account)).resolves.toBe('disabled');
    expect(deps.transport.requestPermission).not.toHaveBeenCalled();
    expect(deps.client.register).not.toHaveBeenCalled();
  });

  test('development-signed Release reports a limitation without registration', async () => {
    const deps = fixture();
    deps.foundation.environment = 'production';
    await expect(deps.foundation.status()).resolves.toBe(
      'development_build_limitation',
    );
    await expect(deps.foundation.enable(account)).resolves.toBe(
      'development_build_limitation',
    );
    expect(deps.transport.requestPermission).not.toHaveBeenCalled();
    expect(deps.transport.token).not.toHaveBeenCalled();
    expect(deps.client.register).not.toHaveBeenCalled();
  });

  test('production entitlement and runtime retain normal registration', async () => {
    const deps = fixture();
    deps.foundation.environment = 'production';
    deps.foundation.apsEnvironment = 'production';
    await expect(deps.foundation.enable(account)).resolves.toBe('enabled');
    expect(deps.client.register).toHaveBeenCalledWith(
      expect.objectContaining({
        registration: expect.objectContaining({ environment: 'production' }),
      }),
    );
  });

  test('records denial without requesting a token', async () => {
    const deps = fixture('denied');
    await expect(deps.foundation.enable(account)).resolves.toBe(
      'permission_denied',
    );
    expect(deps.store.setPreference).toHaveBeenCalledWith('denied');
    expect(deps.transport.token).not.toHaveBeenCalled();
  });

  test('status detects when iOS permission was revoked after registration', async () => {
    const deps = fixture('denied');
    deps.store.preference.mockResolvedValue('enabled');
    await expect(deps.foundation.status()).resolves.toBe('permission_denied');
  });

  test('registers minimum metadata only after contextual enablement', async () => {
    const deps = fixture();
    await expect(deps.foundation.enable(account)).resolves.toBe('enabled');
    expect(deps.client.register).toHaveBeenCalledWith({
      installationId: 'installation',
      authToken: account.authToken,
      authClientId: account.clientId,
      registration: {
        platform: 'ios',
        environment: 'staging',
        appId: 'org.adjusternetwork.app',
        appVersion: '1.0.0',
        build: '1',
        transportToken: 'transport-token',
      },
    });
    expect(account.clientId).toBe('synthetic-client-id');
  });

  test('coalesces duplicate registration attempts', async () => {
    const deps = fixture();
    const attempts = await Promise.all([
      deps.foundation.enable(account),
      deps.foundation.enable(account),
    ]);
    expect(attempts).toEqual(['enabled', 'enabled']);
    expect(deps.client.register).toHaveBeenCalledTimes(1);
  });

  test('turns backend rate limiting into a bounded member-safe cooldown', async () => {
    const deps = fixture();
    deps.client.register.mockRejectedValue(
      new Error('push_backend_rejected_429'),
    );
    await expect(deps.foundation.enable(account)).rejects.toThrow(
      'backend_rate_limited',
    );
    await expect(deps.foundation.enable(account)).rejects.toThrow(
      'backend_rate_limited',
    );
    expect(deps.client.register).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['permission before auth', 'transport-token'],
    ['permission after auth', 'transport-token'],
  ])(
    'keeps auth, APNs, and installation identities separate: %s',
    async (_timing, apnsToken) => {
      const deps = fixture();
      const authenticatedSite = {
        authToken: 'synthetic-user-api-key',
        clientId: 'auth-client-A',
      };
      deps.transport.token.mockResolvedValue(apnsToken);
      deps.store.installationId.mockResolvedValue('installation-C');

      await deps.foundation.enable(authenticatedSite);

      expect(deps.client.register).toHaveBeenCalledWith(
        expect.objectContaining({
          installationId: 'installation-C',
          authClientId: 'auth-client-A',
          registration: expect.objectContaining({ transportToken: apnsToken }),
        }),
      );
      expect(authenticatedSite.clientId).toBe('auth-client-A');
      expect(new Set(['auth-client-A', apnsToken, 'installation-C']).size).toBe(
        3,
      );
    },
  );

  test.each([
    ['token', 'apns_token_failure'],
    ['installation', 'installation_identity_failure'],
    ['backend', 'unknown_registration_failure'],
  ])('reports only the safe %s failure stage', async (stage, expected) => {
    const deps = fixture();
    if (stage === 'token') {
      deps.transport.token.mockRejectedValue(
        new Error('private provider error'),
      );
    } else if (stage === 'installation') {
      deps.store.installationId.mockRejectedValue(
        new Error('private keychain error'),
      );
    } else {
      deps.client.register.mockRejectedValue(new Error('private API error'));
    }

    await expect(deps.foundation.enable(account)).rejects.toThrow(expected);
  });

  test.each([
    ['push_backend_nonce_unavailable', 'nonce_failure'],
    ['push_backend_rejected_403', 'backend_rejection'],
    ['push_backend_rejected_transport', 'network_failure'],
  ])('preserves privacy-safe backend category for %s', async (raw, safe) => {
    const deps = fixture();
    deps.client.register.mockRejectedValue(new Error(raw));
    await expect(deps.foundation.enable(account)).rejects.toThrow(safe);
  });

  test('refreshes a rotated token and unregisters on logout', async () => {
    const deps = fixture();
    await deps.foundation.enable(account);
    await deps.refresh('rotated-token');
    expect(
      deps.client.refresh.mock.calls[0][0].registration.transportToken,
    ).toBe('rotated-token');
    await expect(deps.foundation.logout(account)).resolves.toBe(true);
    expect(deps.remove).toHaveBeenCalled();
    expect(deps.client.unregister).toHaveBeenCalledWith({
      installationId: 'installation',
      authToken: account.authToken,
      authClientId: account.clientId,
    });
    expect(deps.store.setPreference).toHaveBeenLastCalledWith('unknown');
    expect(account.clientId).toBe('synthetic-client-id');
  });

  test('APNs rotation before or after auth completion never mutates the auth client ID', async () => {
    const deps = fixture();
    const authenticatedSite = {
      authToken: 'synthetic-user-api-key',
      clientId: 'auth-client-A',
    };
    await deps.foundation.enable(authenticatedSite);

    await deps.refresh('apns-token-B-before-callback');
    expect(authenticatedSite.clientId).toBe('auth-client-A');
    expect(deps.client.refresh).toHaveBeenLastCalledWith(
      expect.objectContaining({
        installationId: 'installation',
        authClientId: 'auth-client-A',
        registration: expect.objectContaining({
          transportToken: 'apns-token-B-before-callback',
        }),
      }),
    );

    await deps.refresh('apns-token-B-after-callback');
    expect(authenticatedSite.clientId).toBe('auth-client-A');
  });

  test('synchronizes an authenticated preference change', async () => {
    const deps = fixture();
    await deps.foundation.enable(account);
    await expect(deps.foundation.setPreference(false)).resolves.toBe(true);
    expect(deps.client.updatePreferences).toHaveBeenCalledWith({
      installationId: 'installation',
      authToken: account.authToken,
      authClientId: account.clientId,
      enabled: false,
    });
    expect(deps.store.setPreference).toHaveBeenLastCalledWith('denied');
  });
});
