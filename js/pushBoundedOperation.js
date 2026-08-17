/* @flow */
'use strict';

// Native permission/APNs calls should normally settle quickly, while secure
// persistence and network operations need more room on a busy physical device.
// Every value remains finite so registration can always return a safe result.
export const PUSH_OPERATION_TIMEOUT_MS = Object.freeze({
  AUTHORIZATION: 15000,
  APNS_TOKEN: 15000,
  INSTALLATION_IDENTITY: 15000,
  NONCE: 10000,
  BACKEND_TRANSPORT: 30000,
  TOKEN_REFRESH: 45000,
  PREFERENCE_PERSISTENCE: 10000,
  INITIAL_NOTIFICATION: 10000,
});

export function boundedPushOperation(
  operation,
  { timeoutMs, timeoutCode, onTimeout = () => {} },
) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = callback => value => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        onTimeout();
      } catch {
        // Cleanup must not replace the bounded operation result.
      }
      reject(new Error(timeoutCode));
    }, timeoutMs);

    Promise.resolve().then(operation).then(finish(resolve), finish(reject));
  });
}
