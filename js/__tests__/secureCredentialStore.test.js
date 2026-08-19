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

  test('isolates staging and production tokens behind distinct services', async () => {
    await credentialStore.storeSiteToken(
      'https://adjusternetwork.org',
      'production-synthetic',
    );
    await credentialStore.storeSiteToken(
      'https://staging.adjusternetwork.org',
      'staging-synthetic',
    );
    const productionService =
      Keychain.setGenericPassword.mock.calls[0][2].service;
    const stagingService = Keychain.setGenericPassword.mock.calls[1][2].service;
    expect(stagingService).not.toBe(productionService);
  });

  test('stores RSA material behind a distinct platform service', async () => {
    await credentialStore.storeRSAKeys({ public: 'pub', private: 'private' });
    const [, , options] = Keychain.setGenericPassword.mock.calls[0];
    expect(options.service).toBe('org.adjusternetwork.native.rsa.v1');
  });

  test.each(['not-json', JSON.stringify({ public: 'pub' })])(
    'discards stale malformed RSA material without exposing it (%s)',
    async storedValue => {
      Keychain.getGenericPassword.mockResolvedValueOnce({
        username: 'adjuster-network',
        password: storedValue,
      });

      await expect(credentialStore.readRSAKeys()).resolves.toBeNull();
      expect(Keychain.resetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'org.adjusternetwork.native.rsa.v1',
        }),
      );
    },
  );

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
