/* @flow */
'use strict';

export const INVALID_USER_API_CREDENTIAL = Object.freeze({
  errorType: 'invalid_user_api_credential',
  reason: 'invalid_or_revoked_or_expired',
});

export const classifyAuthResponse = (status: number, payload: ?Object) => {
  if (
    status === 401 &&
    payload?.error_type === INVALID_USER_API_CREDENTIAL.errorType &&
    payload?.reason === INVALID_USER_API_CREDENTIAL.reason
  ) {
    return 'revoked';
  }
  if (status === 403) return 'forbidden';
  return 'other';
};
