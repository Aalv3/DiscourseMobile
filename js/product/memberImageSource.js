/* @flow */
'use strict';

import { isCanonicalUrl, parseHttpsUrl } from '../adjusterNetworkSecurity';

// Only the governed private member-photo route requires the User API
// credential. Ordinary Discourse avatars are served from /user_avatar/ and are
// readable without one; authenticating them turns every rendered avatar into a
// counted user-API request, which exhausts the member's rate limit and starves
// the real API calls behind it.
const MEMBER_PHOTO_PATH = /^\/renaissance\/member-photo\//;

// Private member photos are served by the governed origin and require the same
// User API credential the JSON API already sends. React Native's image loader
// runs its own native pipeline and attaches none of the app's credentials, so
// an authenticated image request must carry them explicitly.
//
// The credential is attached only when the resolved URL is on the trusted
// Adjuster Network origin. An avatar_template may carry an absolute URL to an
// external host - letter avatars, gravatar-style services, a CDN - and those
// must never receive a User API key. isCanonicalUrl also rejects plain HTTP,
// so the credential cannot leave over an unencrypted connection.
//
// Nothing is placed in the URL, query string, or any log: the credential
// travels only as a request header.
export function authenticatedOriginHeaders(site, uri) {
  if (!uri || !site?.authToken || !isCanonicalUrl(uri)) {
    return undefined;
  }
  return {
    'User-Api-Key': site.authToken,
    'User-Api-Client-Id': site.clientId || '',
  };
}

export function isMemberPhotoUrl(uri) {
  const url = parseHttpsUrl(String(uri || ''));
  return !!url && MEMBER_PHOTO_PATH.test(url.pathname);
}

export function memberImageSource(site, uri) {
  if (!uri) {
    return null;
  }
  // Avatars render many-per-screen and are loaded by the native image
  // pipeline, outside the app's request orchestrator and its rate-limit
  // cooldowns. Only the private member-photo route may carry the credential.
  if (!isMemberPhotoUrl(uri)) {
    return { uri };
  }
  const headers = authenticatedOriginHeaders(site, uri);
  return headers ? { uri, headers } : { uri };
}
