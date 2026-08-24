/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTHORIZATION_PROFILE_VERSION = 2;
const PREFIX = '@AdjusterNetwork.authorizationProfile.';

function key(clientId) {
  return `${PREFIX}${clientId || 'missing'}`;
}

export async function authorizationProfileCurrent(clientId) {
  if (!clientId) return false;
  return (
    (await AsyncStorage.getItem(key(clientId))) ===
    String(AUTHORIZATION_PROFILE_VERSION)
  );
}

export async function markAuthorizationProfileCurrent(clientId) {
  if (!clientId) return false;
  await AsyncStorage.setItem(
    key(clientId),
    String(AUTHORIZATION_PROFILE_VERSION),
  );
  return true;
}

export async function clearAuthorizationProfile(clientId) {
  if (clientId) await AsyncStorage.removeItem(key(clientId));
}
