/* @flow */
'use strict';

import { isCanonicalUrl } from '../adjusterNetworkSecurity';

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
export function memberImageSource(site, uri) {
  if (!uri) {
    return null;
  }
  if (!site?.authToken || !isCanonicalUrl(uri)) {
    return { uri };
  }
  return {
    uri,
    headers: {
      'User-Api-Key': site.authToken,
      'User-Api-Client-Id': site.clientId || '',
    },
  };
}
