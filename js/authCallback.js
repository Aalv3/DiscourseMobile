/* @flow */
'use strict';

import { isSafeAuthCallback } from './adjusterNetworkSecurity';

export function parseAuthCallbackParameters(callback) {
  if (!isSafeAuthCallback(callback)) {
    return {};
  }

  try {
    const queryStart = callback.indexOf('?');
    const query = queryStart >= 0 ? callback.slice(queryStart + 1) : '';
    const parameters = query.split('&').reduce((result, entry) => {
      if (!entry) return result;
      const separator = entry.indexOf('=');
      const encodedName = separator >= 0 ? entry.slice(0, separator) : entry;
      const encodedValue = separator >= 0 ? entry.slice(separator + 1) : '';
      result[decodeURIComponent(encodedName)] =
        decodeURIComponent(encodedValue);
      return result;
    }, {});
    return parameters;
  } catch {
    return {};
  }
}

export function parseDecryptedAuthPayload(plaintext) {
  if (typeof plaintext !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(plaintext);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}
