/* @flow */
'use strict';

// FCM is intentionally absent until the A3-owned Firebase projects exist.
// This fail-closed adapter lets the lifecycle be integrated and mock-certified
// without silently selecting a provider or introducing Analytics.
const unavailable = () => Promise.reject(new Error('fcm_unconfigured'));

export const pushTransport = Object.freeze({
  platform: 'android',
  permissionState: unavailable,
  requestPermission: unavailable,
  token: unavailable,
  onTokenRefresh() {
    return { remove() {} };
  },
});
