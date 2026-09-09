/* @flow */
'use strict';

import * as Updates from 'expo-updates';
import {
  authRedirectForChannel,
  trustedUpdateChannel,
} from './channelIdentity';

// Derived from the compiled-in channel so a Preview build never claims
// Production's callback. Scopes, groups and consent copy are unchanged.
export const AUTH_REDIRECT = authRedirectForChannel(
  trustedUpdateChannel(Updates.channel),
);

export const REQUESTED_USER_API_KEY_SCOPES = Object.freeze([
  'read',
  'write',
  'notifications',
  'session_info',
  'one_time_password',
  'adjuster-network-renaissance:member_discovery',
]);

export const USER_API_KEY_SCOPE_COPY = Object.freeze({
  read: 'Read discussions and member-visible content',
  write: 'Create, edit, and delete supported discussion content',
  notifications: 'Read and clear notifications',
  session_info: 'Read signed-in session information',
  one_time_password: 'Open an authenticated session in the app',
  'adjuster-network-renaissance:member_discovery':
    'Find Adjuster Network members',
});

export function requestedUserApiKeyScopes() {
  return REQUESTED_USER_API_KEY_SCOPES.join(',');
}
