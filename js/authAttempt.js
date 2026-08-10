/* @flow */
'use strict';

export function consumePendingAuthAttempt(manager) {
  const attempt = {
    site: manager._nonceSite,
    nonce: manager._nonce,
  };

  manager._nonceSite = null;
  manager._nonce = null;
  return attempt;
}
