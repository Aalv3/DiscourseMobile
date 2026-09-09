/* @flow */
'use strict';

export const memberDisplayName = (name, username) => {
  const suppliedName = String(name || '').trim();
  if (suppliedName && suppliedName.toLowerCase() !== 'member') {
    return suppliedName;
  }
  const suppliedUsername = String(username || '').trim();
  if (!suppliedUsername || suppliedUsername.toLowerCase() === 'member') {
    return null;
  }
  return suppliedUsername
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part =>
      part.length <= 2
        ? part.toUpperCase()
        : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ');
};
