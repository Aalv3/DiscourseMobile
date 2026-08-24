/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTHORIZATION_PROFILE_VERSION = 2;
export const AUTHORIZATION_PROFILE_ID = 'founding_100_activation_v1';
export const REQUIRED_AUTHORIZATION_SCOPES = Object.freeze([
  'read',
  'write',
  'notifications',
  'session_info',
  'one_time_password',
  'adjuster-network-renaissance:member_discovery',
  'adjuster-network-renaissance:profile_onboarding',
  'adjuster-network-renaissance:creator_delete',
  'adjuster-network-renaissance:admission_handoff',
  'adjuster-network-renaissance:authorization_profile',
]);
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

export function validateAuthorizationProfile(payload, clientId) {
  if (
    !payload ||
    payload.profile_id !== AUTHORIZATION_PROFILE_ID ||
    payload.client_id !== clientId ||
    payload.exact_match !== true ||
    !Array.isArray(payload.granted_scopes) ||
    !Array.isArray(payload.required_scopes)
  ) {
    return false;
  }
  const granted = [...new Set(payload.granted_scopes)].sort();
  const required = [...REQUIRED_AUTHORIZATION_SCOPES].sort();
  return (
    granted.length === required.length &&
    granted.every((scope, index) => scope === required[index]) &&
    payload.required_scopes.length === required.length &&
    [...payload.required_scopes]
      .sort()
      .every((scope, index) => scope === required[index])
  );
}

export async function clearAuthorizationProfile(clientId) {
  if (clientId) await AsyncStorage.removeItem(key(clientId));
}
