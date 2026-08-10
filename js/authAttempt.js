/* @flow */
'use strict';

export function consumePendingAuthAttempt(manager) {
  const attempt = {
    site: manager._nonceSite,
    nonce: manager._nonce,
  };

  manager._nonceSite = null;
  manager._nonce = null;
  return attempt;
}

export function shouldOpenCallbackOneTimePassword(platform) {
  // Android authenticates and renders private pages in the same system browser,
  // so replaying the callback OTP only pulls Chrome back over the app after the
  // API key has already been accepted. iOS still needs the OTP to establish the
  // separate native WebView session.
  return platform === 'ios';
}
