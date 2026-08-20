/* @flow */
'use strict';

const flagTypeCache = new WeakMap();

const supportedFlag = type =>
  type?.is_flag === true &&
  ['inappropriate', 'notify_moderators'].includes(type?.name_key) &&
  Number.isInteger(type?.id);

export async function moderationFlagType(site) {
  if (!site?.authToken) throw new Error('authentication_required');
  if (flagTypeCache.has(site)) return flagTypeCache.get(site);
  const request = site
    .jsonApi('/site.json')
    .then(payload => {
      const types = Array.isArray(payload?.post_action_types)
        ? payload.post_action_types
        : [];
      const type =
        types.find(
          item => item?.name_key === 'inappropriate' && supportedFlag(item),
        ) || types.find(supportedFlag);
      if (!type) throw new Error('reporting_unavailable');
      return type.id;
    })
    .catch(error => {
      flagTypeCache.delete(site);
      throw error;
    });
  flagTypeCache.set(site, request);
  return request;
}

export async function reportPost(site, postId) {
  if (!Number.isInteger(postId)) throw new Error('reporting_unavailable');
  const postActionTypeId = await moderationFlagType(site);
  return site.jsonApi('/post_actions.json', 'POST', {
    id: postId,
    post_action_type_id: postActionTypeId,
    flag_topic: false,
  });
}

export async function reportChatMessage(site, channelId, messageId) {
  if (!Number.isInteger(channelId) || !Number.isInteger(messageId)) {
    throw new Error('reporting_unavailable');
  }
  const flagTypeId = await moderationFlagType(site);
  return site.jsonApi(
    `/chat/api/channels/${channelId}/messages/${messageId}/flags.json`,
    'POST',
    { flag_type_id: flagTypeId },
  );
}

export async function blockMember(site, username) {
  const value = String(username || '').trim();
  if (!site?.authToken) throw new Error('authentication_required');
  if (
    !value ||
    value.toLowerCase() === String(site.username || '').toLowerCase()
  ) {
    throw new Error('blocking_unavailable');
  }
  const expiringAt = new Date();
  expiringAt.setUTCFullYear(expiringAt.getUTCFullYear() + 10);
  return site.jsonApi(
    `/u/${encodeURIComponent(value)}/notification_level.json`,
    'PUT',
    { notification_level: 'ignore', expiring_at: expiringAt.toISOString() },
  );
}

export function moderationFailureMessage(error, action) {
  if (error?.status === 401) return 'Sign in again to continue.';
  if (error?.status === 403 || error?.status === 422) {
    return action === 'block'
      ? 'This member cannot be blocked by your account.'
      : 'This content could not be reported by your account.';
  }
  if (error?.status === 429) return 'Please wait before trying again.';
  return action === 'block'
    ? 'The member could not be blocked. Check your connection and try again.'
    : 'The report could not be sent. Check your connection and try again.';
}

export async function deleteOwnAccount(site) {
  const username = String(site?.username || '').trim();
  if (!site?.authToken || !username) throw new Error('authentication_required');
  return site.jsonApi(`/u/${encodeURIComponent(username)}.json`, 'DELETE', {
    context: 'native_member_request',
  });
}
