/* @flow */
'use strict';

import { useEffect, useState } from 'react';

type AvatarRecord = {
  template: string,
  version: number,
  confirmed: boolean,
};

const authorities = new Map();
const listeners = new Map();
let nextVersion = 0;

const scopeKey = (site, username) =>
  `${String(site?.url || '')}:${String(username || '').toLowerCase()}`;

const notify = key => {
  (listeners.get(key) || []).forEach(listener => listener());
};

export function avatarAuthoritySnapshot(site, username): ?AvatarRecord {
  return authorities.get(scopeKey(site, username)) || null;
}

export function captureAvatarAuthorityVersion(site, username): number {
  return avatarAuthoritySnapshot(site, username)?.version || 0;
}

export function publishAvatarAuthority(
  site,
  username,
  template,
): ?AvatarRecord {
  const normalized = String(template || '');
  if (!normalized) return avatarAuthoritySnapshot(site, username);
  const key = scopeKey(site, username);
  nextVersion += 1;
  const record = {
    template: normalized,
    version: nextVersion,
    confirmed: false,
  };
  authorities.set(key, record);
  notify(key);
  return record;
}

export function reconcileAvatarAuthority(
  site,
  username,
  template,
  requestVersion: number,
): string {
  const normalized = String(template || '');
  const key = scopeKey(site, username);
  const current = authorities.get(key);

  if (!current) {
    if (!normalized) return '';
    nextVersion += 1;
    authorities.set(key, {
      template: normalized,
      version: nextVersion,
      confirmed: true,
    });
    notify(key);
    return normalized;
  }

  if (requestVersion < current.version) return current.template;

  if (!current.confirmed) {
    if (normalized === current.template) current.confirmed = true;
    return current.template;
  }

  if (normalized && normalized !== current.template) {
    nextVersion += 1;
    authorities.set(key, {
      template: normalized,
      version: nextVersion,
      confirmed: true,
    });
    notify(key);
    return normalized;
  }

  return current.template;
}

export function subscribeAvatarAuthority(site, username, listener) {
  const key = scopeKey(site, username);
  const scoped = listeners.get(key) || new Set();
  scoped.add(listener);
  listeners.set(key, scoped);
  return () => {
    scoped.delete(listener);
    if (scoped.size === 0) listeners.delete(key);
  };
}

export function useAvatarAuthority(site, username): ?string {
  const key = scopeKey(site, username);
  const [, setRevision] = useState(0);
  useEffect(() => {
    const update = () => setRevision(revision => revision + 1);
    const scoped = listeners.get(key) || new Set();
    scoped.add(update);
    listeners.set(key, scoped);
    return () => {
      scoped.delete(update);
      if (scoped.size === 0) listeners.delete(key);
    };
  }, [key]);
  return authorities.get(key)?.template || null;
}

export function clearAvatarAuthorityForSite(site) {
  const prefix = `${String(site?.url || '')}:`;
  [...authorities.keys()].forEach(key => {
    if (key.startsWith(prefix)) {
      authorities.delete(key);
      notify(key);
    }
  });
}

export function clearAvatarAuthorities() {
  const keys = [...authorities.keys()];
  authorities.clear();
  nextVersion = 0;
  keys.forEach(notify);
}
