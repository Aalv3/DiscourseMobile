/* @flow */
'use strict';

export function classifyNotificationLoadError(error) {
  if (error?.message === 'auth_revoked' || error?.status === 401) {
    return 'unauthorized';
  }
  if (error?.status >= 500) return 'backend';
  return 'network';
}
