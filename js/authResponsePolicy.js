/* @flow */
'use strict';

export const classifyAuthResponse = (status: number) => {
  if (status === 401) return 'revoked';
  if (status === 403) return 'forbidden';
  return 'other';
};
