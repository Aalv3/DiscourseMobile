'use strict';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUTHORIZATION_PROFILE_VERSION,
  AUTHORIZATION_PROFILE_ID,
  REQUIRED_AUTHORIZATION_SCOPES,
  authorizationProfileCurrent,
  markAuthorizationProfileCurrent,
  validateAuthorizationProfile,
} from '../authorizationProfile';

beforeEach(() => AsyncStorage.clear());

test('legacy sessions fail toward explicit scope reauthorization', async () => {
  await expect(authorizationProfileCurrent('client-a')).resolves.toBe(false);
});

test('accepts only server-attested exact scope and client binding', () => {
  const payload = {
    profile_id: AUTHORIZATION_PROFILE_ID,
    client_id: 'client-a',
    exact_match: true,
    granted_scopes: [...REQUIRED_AUTHORIZATION_SCOPES],
    required_scopes: [...REQUIRED_AUTHORIZATION_SCOPES],
  };
  expect(validateAuthorizationProfile(payload, 'client-a')).toBe(true);
  expect(
    validateAuthorizationProfile(
      { ...payload, granted_scopes: payload.granted_scopes.slice(1) },
      'client-a',
    ),
  ).toBe(false);
  expect(validateAuthorizationProfile(payload, 'client-b')).toBe(false);
  expect(
    validateAuthorizationProfile(
      { ...payload, exact_match: false },
      'client-a',
    ),
  ).toBe(false);
});

test('records only the profile version after successful authorization', async () => {
  await markAuthorizationProfileCurrent('client-a');
  await expect(authorizationProfileCurrent('client-a')).resolves.toBe(true);
  const values = await AsyncStorage.getAllKeys();
  expect(values).toEqual([
    expect.stringContaining('authorizationProfile.client-a'),
  ]);
  expect(String(AUTHORIZATION_PROFILE_VERSION)).toBe('2');
});
