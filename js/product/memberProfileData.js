/* @flow */
'use strict';

const DEFAULT_TIMEOUT_MS = 15000;
const cache = new Map();

const cacheKey = (site, username) =>
  `${String(site?.url || '')}:${String(username || '').toLowerCase()}`;

const bounded = (promise, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error('profile_load_timeout');
      error.code = 'profile_load_timeout';
      reject(error);
    }, timeoutMs);
    Promise.resolve(promise).then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

export function cachedMemberProfileData(site, username) {
  return cache.get(cacheKey(site, username)) || null;
}

export function clearMemberProfileDataCache() {
  cache.clear();
}

export function updateCachedMemberProfileAvatar(site, username, template) {
  const key = cacheKey(site, username);
  const current = cache.get(key);
  if (!current || !template) return;
  const profileUser = current.profile?.user;
  cache.set(key, {
    ...current,
    profile: profileUser
      ? {
          ...current.profile,
          user: { ...profileUser, avatar_template: template },
        }
      : current.profile
      ? { ...current.profile, avatar_template: template }
      : current.profile,
    cardPayload: current.cardPayload
      ? {
          ...current.cardPayload,
          core: {
            ...(current.cardPayload.core || {}),
            avatar_template: template,
          },
        }
      : current.cardPayload,
  });
}

export async function loadMemberProfileData(
  site,
  username,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const encoded = encodeURIComponent(username);
  const self = username === site.username;
  const cardPath = self
    ? '/native/v1/profile'
    : `/native/v1/profiles/${encoded}`;
  const [profile, activity, cardPayload] = await bounded(
    Promise.all([
      site.jsonApi(`/u/${encoded}.json`).catch(() => null),
      site
        .jsonApi(`/user_actions.json?username=${encoded}&filter=4,5`)
        .catch(() => ({ user_actions: [] })),
      site.jsonApi(cardPath),
    ]),
    timeoutMs,
  );
  const result = { profile, activity, cardPayload };
  cache.set(cacheKey(site, username), result);
  return result;
}
