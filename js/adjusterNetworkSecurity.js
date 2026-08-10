/* @flow */
'use strict';

import { adjusterNetwork } from './adjusterNetworkConfig';

const CALLBACKS = Object.freeze([
  'discourse://auth_redirect',
  'discourse://open',
]);

export function parseHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function isCanonicalUrl(value) {
  const url = parseHttpsUrl(value);
  return !!url && url.origin === adjusterNetwork.canonicalOrigin;
}

export function classifyNavigation(value) {
  if (typeof value !== 'string' || value.length > 4096) {
    return 'reject';
  }
  if (
    CALLBACKS.some(prefix => value === prefix || value.startsWith(`${prefix}?`))
  ) {
    return 'callback';
  }
  const url = parseHttpsUrl(value);
  if (!url) {
    return value === 'about:blank' ? 'blank' : 'reject';
  }
  return url.origin === adjusterNetwork.canonicalOrigin
    ? 'internal'
    : 'external';
}

export function isSafeAuthCallback(value) {
  return classifyNavigation(value) === 'callback';
}

// Diagnostics accept fixed event names only. Never pass URLs, payloads,
// credentials, responses, email addresses, or user-generated content here.
export function securityEvent(eventName) {
  // eslint-disable-next-line no-undef
  if (__DEV__ && /^[a-z0-9_.-]{1,64}$/.test(eventName)) {
    console.log(`[AN] ${eventName}`);
  }
}
