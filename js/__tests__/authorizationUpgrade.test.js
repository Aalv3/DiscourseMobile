'use strict';

const mockStoreSiteToken = jest.fn();
const mockRemoveSiteToken = jest.fn();
jest.mock('../secureCredentialStore', () => ({
  credentialStore: {
    storeSiteToken: (...args) => mockStoreSiteToken(...args),
    removeSiteToken: (...args) => mockRemoveSiteToken(...args),
  },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-native-community/push-notification-ios', () => ({}));
jest.mock('react-native-device-info', () => ({
  getDeviceName: jest.fn().mockResolvedValue('Synthetic Device'),
}));
jest.mock('react-native-key-pair', () => ({}));
jest.mock('@react-native-cookies/cookies', () => ({ clearAll: jest.fn() }));
jest.mock('react-native-safari-web-auth', () => ({}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import SiteManager from '../site_manager';
import {
  AUTHORIZATION_PROFILE_ID,
  REQUIRED_AUTHORIZATION_SCOPES,
  authorizationProfileCurrent,
} from '../authorizationProfile';

function managerWith(site, replacement = 'replacement-key') {
  const manager = Object.create(SiteManager.prototype);
  manager._nonceSite = site;
  manager._nonce = 'expected-nonce';
  manager.decryptHelper = jest.fn(() =>
    JSON.stringify({ nonce: 'expected-nonce', key: replacement }),
  );
  manager.save = jest.fn();
  manager._onChange = jest.fn();
  return manager;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockStoreSiteToken.mockResolvedValue();
  mockRemoveSiteToken.mockResolvedValue();
});

test('attests exact scopes before replacing the stored credential', async () => {
  const site = {
    url: 'https://adjusternetwork.org',
    clientId: 'client-a',
    authToken: 'old-key',
    jsonApi: jest.fn().mockResolvedValue({
      profile_id: AUTHORIZATION_PROFILE_ID,
      client_id: 'client-a',
      exact_match: true,
      granted_scopes: [...REQUIRED_AUTHORIZATION_SCOPES],
      required_scopes: [...REQUIRED_AUTHORIZATION_SCOPES],
    }),
    refresh: jest.fn().mockResolvedValue(),
  };
  const manager = managerWith(site);
  await expect(manager.handleAuthPayload('encrypted')).resolves.toBe(true);
  expect(site.jsonApi).toHaveBeenCalledWith('/native/v1/authorization-profile');
  expect(mockStoreSiteToken).toHaveBeenCalledWith(site.url, 'replacement-key');
  await expect(authorizationProfileCurrent('client-a')).resolves.toBe(true);
});

test('missing scope preserves the prior key and does not mark profile current', async () => {
  const site = {
    url: 'https://adjusternetwork.org',
    clientId: 'client-a',
    authToken: 'old-key',
    jsonApi: jest.fn().mockResolvedValue({
      profile_id: AUTHORIZATION_PROFILE_ID,
      client_id: 'client-a',
      exact_match: false,
      granted_scopes: REQUIRED_AUTHORIZATION_SCOPES.slice(1),
      required_scopes: [...REQUIRED_AUTHORIZATION_SCOPES],
    }),
  };
  const manager = managerWith(site);
  await expect(manager.handleAuthPayload('encrypted')).resolves.toBe(false);
  expect(site.authToken).toBe('old-key');
  expect(mockStoreSiteToken).toHaveBeenCalledWith(site.url, 'old-key');
  expect(mockStoreSiteToken).not.toHaveBeenCalledWith(
    site.url,
    'replacement-key',
  );
  await expect(authorizationProfileCurrent('client-a')).resolves.toBe(false);
});
