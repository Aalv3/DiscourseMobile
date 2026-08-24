'use strict';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUTHORIZATION_PROFILE_VERSION,
  authorizationProfileCurrent,
  markAuthorizationProfileCurrent,
} from '../authorizationProfile';

beforeEach(() => AsyncStorage.clear());

test('legacy sessions fail toward explicit scope reauthorization', async () => {
  await expect(authorizationProfileCurrent('client-a')).resolves.toBe(false);
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
