/* @flow */
'use strict';

export const AUTH_FAILURE = Object.freeze({
  NETWORK: 'network_failure',
  KEYCHAIN: 'keychain_failure',
  AUTH_URL: 'auth_url_failure',
  PRESENTATION: 'presentation_failure',
  USER_CANCEL: 'user_cancel',
  CALLBACK: 'callback_failure',
  UNKNOWN: 'unknown_failure',
});

// Keychain access can fail for reasons that never mention "keychain": iOS
// reports a missing entitlement as OSStatus -34018, and react-native-keychain
// surfaces it as a bare "OSStatus error" string. Those are security
// configuration faults, not connectivity faults, and must never be presented
// to a member as a network problem.
const SECURITY_PATTERNS = [
  'keychain',
  'credential',
  'rsa_key',
  'secure_storage',
  'entitlement',
  'osstatus',
  'errsec',
  '-34018',
  'secitem',
];

// Only a genuine transport fault may use the connectivity copy. Anything that
// is not recognised here stays UNKNOWN rather than borrowing that message.
const NETWORK_PATTERNS = [
  'network request failed',
  'network error',
  'timeout',
  'timed out',
  'offline',
  'connection',
  'unable to connect',
  'could not connect',
  'host',
  'dns',
  'econn',
  'enotfound',
  'internet',
];

function haystack(error) {
  // `code` alone is not enough: a native rejection can carry a numeric code
  // while the diagnostic detail lives only in the message.
  return [error?.code, error?.message, error?.name]
    .filter(value => value !== undefined && value !== null)
    .map(value => String(value))
    .join(' ')
    .toLowerCase();
}

export function classifyAuthFailure(error) {
  const text = haystack(error);

  if (text.includes('auth_user_cancelled')) return AUTH_FAILURE.USER_CANCEL;
  if (
    text.includes('auth_presentation') ||
    text.includes('auth_start_failed') ||
    text.includes('auth_session_failed')
  ) {
    return AUTH_FAILURE.PRESENTATION;
  }
  if (SECURITY_PATTERNS.some(pattern => text.includes(pattern))) {
    return AUTH_FAILURE.KEYCHAIN;
  }
  if (text.includes('auth_invalid_url') || text.includes('auth_origin')) {
    return AUTH_FAILURE.AUTH_URL;
  }
  if (
    text.includes('auth_callback') ||
    text.includes('auth_payload') ||
    text.includes('auth_nonce')
  ) {
    return AUTH_FAILURE.CALLBACK;
  }
  if (NETWORK_PATTERNS.some(pattern => text.includes(pattern))) {
    return AUTH_FAILURE.NETWORK;
  }

  // A programming fault (TypeError, undefined native module) reaching this
  // point previously rendered as "Unable to connect", which sent members and
  // operators to look at connectivity instead of the real defect.
  return AUTH_FAILURE.UNKNOWN;
}

export function authFailureAlert(category) {
  switch (category) {
    case AUTH_FAILURE.KEYCHAIN:
      return {
        title: 'Secure sign-in unavailable',
        message: 'Secure sign-in could not be prepared. Please try again.',
      };
    case AUTH_FAILURE.AUTH_URL:
      return {
        title: 'Sign-in could not start',
        message: 'The secure sign-in request could not be prepared.',
      };
    case AUTH_FAILURE.PRESENTATION:
      return {
        title: 'Sign-in could not open',
        message:
          'The secure sign-in window could not be opened. Please try again.',
      };
    case AUTH_FAILURE.CALLBACK:
      return {
        title: 'Sign-in could not finish',
        message:
          'The secure sign-in response could not be verified. Please try again.',
      };
    case AUTH_FAILURE.NETWORK:
      return {
        title: 'Unable to connect',
        message: 'Please try again in a moment.',
      };
    default:
      return {
        title: 'Sign-in could not be completed',
        message: 'Sign-in could not be completed. Please try again.',
      };
  }
}
