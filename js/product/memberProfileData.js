/* @flow */
'use strict';

import {
  profileErrorCategory,
  recordProfileDiagnostic,
} from '../profileDiagnostics';
import {
  captureAvatarAuthorityVersion,
  clearAvatarAuthorities,
  publishAvatarAuthority,
  reconcileAvatarAuthority,
} from './avatarAuthority';

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
  clearAvatarAuthorities();
}

export function updateCachedMemberProfileAvatar(site, username, template) {
  const key = cacheKey(site, username);
  if (!template) return;
  publishAvatarAuthority(site, username, template);
  const current = cache.get(key);
  if (!current) return;
  cache.set(key, withAvatar(current, template));
}

const avatarTemplateFrom = result =>
  result?.cardPayload?.core?.avatar_template ||
  result?.profile?.user?.avatar_template ||
  result?.profile?.avatar_template ||
  '';

const withAvatar = (result, template) => {
  const profileUser = result.profile?.user;
  return {
    ...result,
    profile: profileUser
      ? {
          ...result.profile,
          user: { ...profileUser, avatar_template: template },
        }
      : result.profile
      ? { ...result.profile, avatar_template: template }
      : result.profile,
    cardPayload: result.cardPayload
      ? {
          ...result.cardPayload,
          core: {
            ...(result.cardPayload.core || {}),
            avatar_template: template,
          },
        }
      : result.cardPayload,
  };
};

export async function loadMemberProfileData(
  site,
  username,
  diagnosticContext = null,
) {
  const encoded = encodeURIComponent(username);
  const key = cacheKey(site, username);
  const authorityVersionAtStart = captureAvatarAuthorityVersion(site, username);
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
  let result = {
    profile,
    activity: { user_actions: cardPayload?.contributions || [] },
    cardPayload,
  };
  const authoritativeTemplate = reconcileAvatarAuthority(
    site,
    username,
    avatarTemplateFrom(result),
    authorityVersionAtStart,
  );
  if (authoritativeTemplate) result = withAvatar(result, authoritativeTemplate);
  cache.set(key, result);
  return result;
}
