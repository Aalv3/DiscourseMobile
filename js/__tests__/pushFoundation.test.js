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
  const account = { authToken: 'synthetic-user-api-key' };

  test('default-off mode never asks permission or contacts a backend', async () => {
    const deps = fixture();
    deps.foundation.enabled = false;
    await expect(deps.foundation.enable(account)).resolves.toBe('disabled');
    expect(deps.transport.requestPermission).not.toHaveBeenCalled();
    expect(deps.client.register).not.toHaveBeenCalled();
  });

  test('records denial without requesting a token', async () => {
    const deps = fixture('denied');
    await expect(deps.foundation.enable(account)).resolves.toBe('denied');
    expect(deps.store.setPreference).toHaveBeenCalledWith('denied');
    expect(deps.transport.token).not.toHaveBeenCalled();
  });

  test('registers minimum metadata only after contextual enablement', async () => {
    const deps = fixture();
    await expect(deps.foundation.enable(account)).resolves.toBe('enabled');
    expect(deps.client.register).toHaveBeenCalledWith({
      installationId: 'installation',
      authToken: account.authToken,
      registration: {
        platform: 'ios',
        environment: 'staging',
        appId: 'org.adjusternetwork.app',
        appVersion: '1.0.0',
        build: '1',
        transportToken: 'transport-token',
      },
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
    });
    expect(deps.store.setPreference).toHaveBeenLastCalledWith('unknown');
  });

  test('synchronizes an authenticated preference change', async () => {
    const deps = fixture();
    await deps.foundation.enable(account);
    await expect(deps.foundation.setPreference(false)).resolves.toBe(true);
    expect(deps.client.updatePreferences).toHaveBeenCalledWith({
      installationId: 'installation',
      authToken: account.authToken,
      enabled: false,
    });
    expect(deps.store.setPreference).toHaveBeenLastCalledWith('denied');
  });
});
