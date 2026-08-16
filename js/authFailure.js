/* @flow */
'use strict';

export const AUTH_FAILURE = Object.freeze({
  NETWORK: 'network_failure',
  KEYCHAIN: 'keychain_failure',
  AUTH_URL: 'auth_url_failure',
  PRESENTATION: 'presentation_failure',
  USER_CANCEL: 'user_cancel',
  CALLBACK: 'callback_failure',
});

export function classifyAuthFailure(error) {
  const code = String(error?.code || error?.message || '').toLowerCase();
  if (code.includes('auth_user_cancelled')) return AUTH_FAILURE.USER_CANCEL;
  if (
    code.includes('auth_presentation') ||
    code.includes('auth_start_failed') ||
    code.includes('auth_session_failed')
  ) {
    return AUTH_FAILURE.PRESENTATION;
  }
  if (
    code.includes('keychain') ||
    code.includes('credential') ||
    code.includes('rsa_key') ||
    code.includes('secure_storage')
  ) {
    return AUTH_FAILURE.KEYCHAIN;
  }
  if (code.includes('auth_invalid_url') || code.includes('auth_origin')) {
    return AUTH_FAILURE.AUTH_URL;
  }
  if (
    code.includes('auth_callback') ||
    code.includes('auth_payload') ||
    code.includes('auth_nonce')
  ) {
    return AUTH_FAILURE.CALLBACK;
  }
  return AUTH_FAILURE.NETWORK;
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
    default:
      return {
        title: 'Unable to connect',
        message: 'Please try again in a moment.',
      };
  }
}
