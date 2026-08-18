import { PushFoundation } from '../pushFoundation';
import {
  PUSH_HTTP_STATUS_CLASS,
  PUSH_REGISTRATION_CATEGORY,
  PUSH_REGISTRATION_STAGE,
  pushRegistrationFailure,
} from '../pushRegistrationResult';

function fixture(permission = 'granted') {
  const onResult = jest.fn();
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
    appId: 'org.adjusternetwork.app',
    appVersion: '1.0.0',
    build: '1',
    store,
    transport,
    client,
    onResult,
    permissionCheckTimeoutMs: 25,
    permissionRequestTimeoutMs: 25,
    installationTimeoutMs: 25,
    preferenceTimeoutMs: 25,
    refreshTimeoutMs: 25,
  });
  return {
    foundation,
    store,
    transport,
    client,
    onResult,
    refresh: token => {
      refreshHandler(token);
      return foundation.refreshPromise;
    },
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

  test('missing runtime environment fails closed without registration', async () => {
    const deps = fixture();
    deps.foundation.environment = null;
    await expect(deps.foundation.status()).resolves.toBe(
      'push_registration_failed',
    );
    await expect(deps.foundation.enable(account)).resolves.toBe(
      'push_registration_failed',
    );
    expect(deps.transport.requestPermission).not.toHaveBeenCalled();
    expect(deps.transport.token).not.toHaveBeenCalled();
    expect(deps.client.register).not.toHaveBeenCalled();
  });

  test('production runtime proceeds to the native permission and APNs pipeline', async () => {
    const deps = fixture();
    deps.foundation.environment = 'production';
    await expect(deps.foundation.enable(account)).resolves.toMatchObject({
      stage: 'completed',
      category: 'enabled',
    });
    expect(deps.client.register).toHaveBeenCalledWith(
      expect.objectContaining({
        registration: expect.objectContaining({ environment: 'production' }),
      }),
    );
    expect(deps.transport.permissionState).toHaveBeenCalledTimes(1);
    expect(deps.transport.requestPermission).not.toHaveBeenCalled();
  });

  test('staging runtime proceeds with the staging backend environment', async () => {
    const deps = fixture();
    await expect(deps.foundation.enable(account)).resolves.toMatchObject({
      stage: 'completed',
      category: 'enabled',
    });
    expect(deps.client.register).toHaveBeenCalledWith(
      expect.objectContaining({
        registration: expect.objectContaining({ environment: 'staging' }),
      }),
    );
    expect(deps.transport.token).toHaveBeenCalledTimes(1);
  });

  test('records existing denial without requesting permission or a token', async () => {
    const deps = fixture('denied');
    await expect(deps.foundation.enable(account)).rejects.toMatchObject({
      result: {
        stage: 'permission_check',
        category: 'permission_denied',
      },
    });
    expect(deps.transport.requestPermission).not.toHaveBeenCalled();
    expect(deps.store.setPreference).toHaveBeenCalledWith('denied');
    expect(deps.transport.token).not.toHaveBeenCalled();
  });

  test('bounds a native permission-state check that never settles', async () => {
    const deps = fixture();
    deps.transport.permissionState.mockReturnValue(new Promise(() => {}));
    await expect(deps.foundation.enable(account)).rejects.toMatchObject({
      result: {
        stage: 'permission_check',
        category: 'permission_failure',
      },
    });
    expect(deps.transport.requestPermission).not.toHaveBeenCalled();
    expect(deps.transport.token).not.toHaveBeenCalled();
  });

  test('fails closed when the native authorization state is unknown', async () => {
    const deps = fixture('unknown');
    await expect(deps.foundation.enable(account)).rejects.toMatchObject({
      result: {
        stage: 'permission_check',
        category: 'permission_failure',
      },
    });
    expect(deps.transport.requestPermission).not.toHaveBeenCalled();
    expect(deps.transport.token).not.toHaveBeenCalled();
  });

  test('status detects when iOS permission was revoked after registration', async () => {
    const deps = fixture('denied');
    deps.store.preference.mockResolvedValue('enabled');
    await expect(deps.foundation.status()).resolves.toBe('permission_denied');
  });

  test('bounds startup preference acquisition', async () => {
    jest.useFakeTimers();
    const deps = fixture();
    deps.store.preference.mockReturnValue(new Promise(() => {}));
    const pending = deps.foundation.status();
    const failure = expect(pending).rejects.toMatchObject({
      result: {
        stage: 'preference_persistence',
        category: 'preference_persistence_failure',
      },
    });
    await jest.advanceTimersByTimeAsync(25);
    await failure;
    jest.useRealTimers();
  });

  test('registers minimum metadata only after contextual enablement', async () => {
    const deps = fixture();
    await expect(deps.foundation.enable(account)).resolves.toMatchObject({
      stage: 'completed',
      category: 'enabled',
    });
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
      onStage: expect.any(Function),
    });
    expect(account.clientId).toBe('synthetic-client-id');
  });

  test('coalesces duplicate registration attempts', async () => {
    const deps = fixture();
    const attempts = await Promise.all([
      deps.foundation.enable(account),
      deps.foundation.enable(account),
    ]);
    expect(attempts).toEqual([
      expect.objectContaining({ category: 'enabled' }),
      expect.objectContaining({ category: 'enabled' }),
    ]);
    expect(deps.client.register).toHaveBeenCalledTimes(1);
  });

  test('turns backend rate limiting into a bounded member-safe cooldown', async () => {
    const deps = fixture();
    deps.client.register.mockRejectedValue(
      pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.BACKEND_RESPONSE,
        PUSH_REGISTRATION_CATEGORY.BACKEND_RATE_LIMITED,
        PUSH_HTTP_STATUS_CLASS.RATE_LIMITED,
      ),
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

  test('bounds an APNs token dependency that never settles', async () => {
    jest.useFakeTimers();
    const deps = fixture();
    deps.transport.token.mockReturnValue(new Promise(() => {}));
    const pending = deps.foundation.enable(account);
    const failure = expect(pending).rejects.toMatchObject({
      result: {
        stage: 'apns_token',
        category: 'apns_token_failure',
      },
    });
    await jest.advanceTimersByTimeAsync(15000);
    await failure;
    jest.useRealTimers();
  });

  test.each([
    ['nonce_generation', 'nonce_failure', 'none'],
    ['backend_response', 'backend_rejection', '4xx'],
    ['backend_transport', 'network_failure', 'none'],
  ])(
    'preserves privacy-safe backend category for %s',
    async (stage, safe, http) => {
      const deps = fixture();
      deps.client.register.mockRejectedValue(
        pushRegistrationFailure(stage, safe, http),
      );
      await expect(deps.foundation.enable(account)).rejects.toThrow(safe);
    },
  );

  test('classifies permission request rejection at its exact stage', async () => {
    const deps = fixture('not_determined');
    deps.transport.requestPermission.mockRejectedValue(new Error('private'));
    await expect(deps.foundation.enable(account)).rejects.toMatchObject({
      result: {
        stage: 'permission_request',
        category: 'permission_failure',
      },
    });
    expect(deps.transport.requestPermission).toHaveBeenCalledTimes(1);
  });

  test('requests permission once only when authorization is not determined', async () => {
    const deps = fixture('not_determined');
    deps.transport.requestPermission.mockResolvedValue('granted');
    await expect(deps.foundation.enable(account)).resolves.toMatchObject({
      stage: 'completed',
      category: 'enabled',
    });
    expect(deps.transport.permissionState).toHaveBeenCalledTimes(1);
    expect(deps.transport.requestPermission).toHaveBeenCalledTimes(1);
    expect(deps.transport.token).toHaveBeenCalledTimes(1);
  });

  test('reports denial from the native prompt at permission_request', async () => {
    const deps = fixture('not_determined');
    deps.transport.requestPermission.mockResolvedValue('denied');
    await expect(deps.foundation.enable(account)).rejects.toMatchObject({
      result: {
        stage: 'permission_request',
        category: 'permission_denied',
      },
    });
    expect(deps.transport.requestPermission).toHaveBeenCalledTimes(1);
  });

  test('bounds a native permission request that never settles', async () => {
    const deps = fixture('not_determined');
    deps.transport.requestPermission.mockReturnValue(new Promise(() => {}));
    await expect(deps.foundation.enable(account)).rejects.toMatchObject({
      result: {
        stage: 'permission_request',
        category: 'permission_failure',
      },
    });
    expect(deps.transport.requestPermission).toHaveBeenCalledTimes(1);
    expect(deps.transport.token).not.toHaveBeenCalled();
  });

  test('startup status and manual retry share the bounded native check', async () => {
    const deps = fixture('granted');
    deps.store.preference.mockResolvedValue('enabled');
    await expect(deps.foundation.status()).resolves.toBe('enabled');
    await expect(deps.foundation.enable(account)).resolves.toMatchObject({
      stage: 'completed',
      category: 'enabled',
    });
    expect(deps.transport.permissionState).toHaveBeenCalledTimes(2);
    expect(deps.transport.requestPermission).not.toHaveBeenCalled();
  });

  test('reports preference persistence after successful backend registration', async () => {
    const deps = fixture();
    deps.client.register.mockResolvedValue('2xx');
    deps.store.setPreference.mockRejectedValueOnce(new Error('private'));
    await expect(deps.foundation.enable(account)).rejects.toMatchObject({
      result: {
        stage: 'preference_persistence',
        category: 'preference_persistence_failure',
        httpStatusClass: '2xx',
      },
    });
    deps.store.setPreference.mockResolvedValue();
    await expect(deps.foundation.enable(account)).resolves.toMatchObject({
      stage: 'completed',
      category: 'enabled',
    });
    expect(deps.client.register).toHaveBeenCalledTimes(1);
  });

  test('bounds installation identity and allows its late result to be reused', async () => {
    jest.useFakeTimers();
    let resolveIdentity;
    const identity = new Promise(resolve => {
      resolveIdentity = resolve;
    });
    const deps = fixture();
    deps.store.installationId.mockReturnValue(identity);
    const first = deps.foundation.enable(account);
    const firstFailure = expect(first).rejects.toMatchObject({
      result: {
        stage: 'installation_identity',
        category: 'installation_identity_failure',
      },
    });
    await jest.advanceTimersByTimeAsync(25);
    await firstFailure;
    resolveIdentity('late-installation');
    await Promise.resolve();
    await expect(deps.foundation.enable(account)).resolves.toMatchObject({
      category: 'enabled',
    });
    expect(deps.client.register).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('bounds preference persistence without duplicating backend registration', async () => {
    jest.useFakeTimers();
    const deps = fixture();
    deps.store.setPreference.mockReturnValueOnce(new Promise(() => {}));
    const first = deps.foundation.enable(account);
    const firstFailure = expect(first).rejects.toMatchObject({
      result: {
        stage: 'preference_persistence',
        category: 'preference_persistence_failure',
      },
    });
    await jest.advanceTimersByTimeAsync(25);
    await firstFailure;
    deps.store.setPreference.mockResolvedValue();
    await expect(deps.foundation.enable(account)).resolves.toMatchObject({
      category: 'enabled',
    });
    expect(deps.client.register).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('catches and reports token refresh rejection without retry looping', async () => {
    const deps = fixture();
    await deps.foundation.enable(account);
    deps.client.refresh.mockRejectedValue(
      pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.BACKEND_TRANSPORT,
        PUSH_REGISTRATION_CATEGORY.NETWORK_FAILURE,
      ),
    );
    deps.refresh('rotated-token');
    await deps.foundation.refreshPromise;
    expect(deps.client.refresh).toHaveBeenCalledTimes(1);
    expect(deps.onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'backend_transport',
        category: 'network_failure',
        outcome: 'failed',
      }),
    );
  });

  test('bounds a token refresh that never settles without an unhandled rejection', async () => {
    jest.useFakeTimers();
    const deps = fixture();
    await deps.foundation.enable(account);
    deps.client.refresh.mockReturnValue(new Promise(() => {}));
    deps.refresh('rotated-token');
    const refresh = deps.foundation.refreshPromise;
    await jest.advanceTimersByTimeAsync(25);
    await expect(refresh).resolves.toBeUndefined();
    expect(deps.client.refresh).toHaveBeenCalledTimes(1);
    expect(deps.onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'backend_transport',
        category: 'network_failure',
        outcome: 'failed',
      }),
    );
    jest.useRealTimers();
  });

  test('does not emit permission_request when authorization is already granted', async () => {
    const deps = fixture('granted');
    await deps.foundation.enable(account);
    const stages = deps.onResult.mock.calls.map(([result]) => [
      result.stage,
      result.outcome,
    ]);
    expect(stages).toContainEqual(['permission_check', 'started']);
    expect(stages).toContainEqual(['permission_check', 'succeeded']);
    expect(stages).not.toContainEqual(['permission_request', 'started']);
    expect(stages).not.toContainEqual(['permission_request', 'succeeded']);
    expect(stages).toContainEqual(['apns_token', 'started']);
  });

  test('manual retry after failure is not poisoned by the prior promise', async () => {
    const deps = fixture();
    deps.transport.token.mockRejectedValueOnce(new Error('private'));
    await expect(deps.foundation.enable(account)).rejects.toThrow(
      'apns_token_failure',
    );
    await expect(deps.foundation.enable(account)).resolves.toMatchObject({
      category: 'enabled',
    });
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
