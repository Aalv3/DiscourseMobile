jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' },
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

import * as Keychain from 'react-native-keychain';
import { credentialStore } from '../secureCredentialStore';

describe('secure credential store', () => {
  beforeEach(() => jest.clearAllMocks());

  test('stores a token in device-only platform storage without putting it in the service name', async () => {
    await credentialStore.storeSiteToken(
      'https://adjusternetwork.org',
      'synthetic-secret',
    );
    const [, secret, options] = Keychain.setGenericPassword.mock.calls[0];
    expect(secret).toBe('synthetic-secret');
    expect(options.service).not.toContain('synthetic-secret');
    expect(options.accessible).toBe('device-only');
  });

  test('removes a site credential on account removal', async () => {
    await credentialStore.removeSiteToken('https://adjusternetwork.org');
    expect(Keychain.resetGenericPassword).toHaveBeenCalledTimes(1);
  });

  test('stores RSA material behind a distinct platform service', async () => {
    await credentialStore.storeRSAKeys({ public: 'pub', private: 'private' });
    const [, , options] = Keychain.setGenericPassword.mock.calls[0];
    expect(options.service).toBe('org.adjusternetwork.native.rsa.v1');
  });

  test('stores push installation identity separately from account tokens', async () => {
    await credentialStore.storePushInstallationId('synthetic-installation');
    const [, value, options] = Keychain.setGenericPassword.mock.calls[0];
    expect(value).toBe('synthetic-installation');
    expect(options.service).toBe(
      'org.adjusternetwork.native.push-installation.v1',
    );
    expect(options.accessible).toBe('device-only');
  });
});
