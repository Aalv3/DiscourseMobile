/* @flow */
'use strict';

export function classifyNotificationLoadError(error) {
  if (error?.message === 'auth_revoked' || error?.status === 401) {
    return 'unauthorized';
  }
  if (error?.status === 429 || error?.message === 'api_rate_limited') {
    return 'rate_limited';
  }
  if (error?.status >= 500) return 'backend';
  return 'network';
}
