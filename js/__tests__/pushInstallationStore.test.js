jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('../secureCredentialStore', () => ({ credentialStore: {} }));

import { PushInstallationStore } from '../pushInstallationStore';

function fixture({ marker = null, secureId = null } = {}) {
  const values = new Map(
    marker ? [['@AdjusterNetwork.push-installation.v1', marker]] : [],
  );
  const storage = {
    getItem: jest.fn(key => Promise.resolve(values.get(key) || null)),
    setItem: jest.fn((key, value) => {
      values.set(key, value);
      return Promise.resolve();
    }),
    multiRemove: jest.fn(() => Promise.resolve()),
  };
  let id = secureId;
  const secureStore = {
    readPushInstallationId: jest.fn(() => Promise.resolve(id)),
    storePushInstallationId: jest.fn(value => {
      id = value;
      return Promise.resolve();
    }),
    removePushInstallationId: jest.fn(() => {
      id = null;
      return Promise.resolve();
    }),
  };
  return { storage, secureStore };
}

describe('push installation store', () => {
  test('reuses the secure identity only within the same installation', async () => {
    const deps = fixture({ marker: '1', secureId: 'existing' });
    const store = new PushInstallationStore({
      ...deps,
      idFactory: () => 'new',
    });
    await expect(store.installationId()).resolves.toBe('existing');
    expect(deps.secureStore.removePushInstallationId).not.toHaveBeenCalled();
  });

  test('rotates an orphaned iOS Keychain identity after reinstall', async () => {
    const deps = fixture({ secureId: 'orphaned' });
    const store = new PushInstallationStore({
      ...deps,
      idFactory: () => 'fresh',
    });
    await expect(store.installationId()).resolves.toBe('fresh');
    expect(deps.secureStore.removePushInstallationId).toHaveBeenCalledTimes(1);
    expect(deps.secureStore.storePushInstallationId).toHaveBeenCalledWith(
      'fresh',
    );
  });
});
