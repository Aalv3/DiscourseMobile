/* @flow */
'use strict';

import SafariWebAuth from 'react-native-safari-web-auth';
import { isSafeAuthCallback } from './adjusterNetworkSecurity';

// Adjuster Network authorization must never inherit an identity the member did
// not choose in this attempt. A non-ephemeral ASWebAuthenticationSession shares
// the system Safari data store, so a previously signed-in account survives app
// deletion and reinstall and silently binds the next User API Key. Every
// authorization therefore starts in a fresh, ephemeral browser-auth context.
// This is not caller-configurable: no call site may opt out.
export const EPHEMERAL_AUTH_SESSION = true;

export async function requestIOSAuth(url, callbackScheme) {
  const callback = await SafariWebAuth.requestAuth(
    url,
    callbackScheme,
    EPHEMERAL_AUTH_SESSION,
  );
  if (!callback || !isSafeAuthCallback(callback)) {
    throw new Error('auth_callback_invalid');
  }
  return callback;
}
