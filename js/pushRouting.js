/* @flow */
'use strict';

const SAFE_MEMBER_PATH = /^\/(t|c|u)\/[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*$/;

export function safePushPath(payload) {
  if (!payload || typeof payload.path !== 'string') {
    return null;
  }
  if (payload.path.length > 2048 || !SAFE_MEMBER_PATH.test(payload.path)) {
    return null;
  }
  if (payload.path.includes('..') || payload.path.includes('://')) {
    return null;
  }
  return payload.path;
}

export function routePush(payload, { origin, authenticated, openUrl }) {
  const path = safePushPath(payload);
  if (!authenticated || !path || typeof openUrl !== 'function') {
    return false;
  }
  openUrl(`${origin}${path}`);
  return true;
}
