/* @flow */
'use strict';

import SafariWebAuth from 'react-native-safari-web-auth';
import { isSafeAuthCallback } from './adjusterNetworkSecurity';

export async function requestIOSAuth(url, callbackScheme, ephemeral = false) {
  const callback = await SafariWebAuth.requestAuth(
    url,
    callbackScheme,
    ephemeral,
  );
  if (!callback || !isSafeAuthCallback(callback)) {
    throw new Error('auth_callback_invalid');
  }
  return callback;
}
