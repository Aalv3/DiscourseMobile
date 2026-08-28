/* @flow */
'use strict';

import {
  profileErrorCategory,
  recordProfileDiagnostic,
} from '../profileDiagnostics';

const cache = new Map();

const cacheKey = (site, username) =>
  `${String(site?.url || '')}:${String(username || '').toLowerCase()}`;

const diagnostic = (context, input) => {
  if (!context?.mountId) return;
  recordProfileDiagnostic({
    mountId: context.mountId,
    sequence: context.sequence,
    ...input,
  });
};

const trackedRequest = (stage, request, context) => {
  diagnostic(context, { event: 'request', stage, outcome: 'started' });
  let promise;
  try {
    promise = request();
  } catch (error) {
    promise = Promise.reject(error);
  }
  return Promise.resolve(promise).then(
    value => {
      diagnostic(context, {
        event: 'request',
        stage,
        outcome: 'settled',
        category: 'success',
      });
      return value;
    },
    error => {
      diagnostic(context, {
        event: 'request',
        stage,
        outcome: 'settled',
        category: profileErrorCategory(error),
      });
      throw error;
    },
  );
};

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
  diagnosticContext = null,
) {
  const encoded = encodeURIComponent(username);
  const self = username === site.username;
  const cardPath = self
    ? '/native/v1/profile'
    : `/native/v1/profiles/${encoded}`;
  let bundle;
  try {
    diagnostic(diagnosticContext, {
      event: 'timer',
      stage: 'network_transport',
      outcome: 'delegated',
    });
    bundle = await Promise.all([
      trackedRequest(
        'member_core',
        () => site.jsonApi(`/u/${encoded}.json`),
        diagnosticContext,
      ).catch(() => null),
      trackedRequest(
        'adjuster_card',
        () => site.jsonApi(cardPath),
        diagnosticContext,
      ),
    ]);
  } catch (error) {
    diagnostic(diagnosticContext, {
      event: 'promise_all',
      stage: 'profile_bundle',
      outcome: 'rejected',
      category: profileErrorCategory(error),
    });
    throw error;
  }
  const [profile, cardPayload] = bundle;
  diagnostic(diagnosticContext, {
    event: 'promise_all',
    stage: 'profile_bundle',
    outcome: 'settled',
    category: 'success',
  });
  const result = {
    profile,
    activity: { user_actions: cardPayload?.contributions || [] },
    cardPayload,
  };
  cache.set(cacheKey(site, username), result);
  return result;
}
