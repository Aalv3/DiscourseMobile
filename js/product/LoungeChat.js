/* @flow */
'use strict';

export const LOUNGE_CHAT_PAGE_SIZE = 50;

const channelName = channel =>
  String(channel?.title || channel?.name || channel?.slug || '')
    .trim()
    .toLowerCase();

export function findLoungeChannel(payloads) {
  const channels = payloads
    .flatMap(payload => [
      ...(payload?.channels || []),
      ...(payload?.public_channels || []),
    ])
    .filter(channel => channel?.id);
  return (
    channels.find(channel => channelName(channel) === 'lounge') ||
    channels.find(channel => channelName(channel).includes('lounge')) ||
    null
  );
}

export function loungeMessagesPath(channelId, oldestMessageId = null) {
  const base = `/chat/api/channels/${channelId}/messages.json?page_size=${LOUNGE_CHAT_PAGE_SIZE}&direction=past`;
  return oldestMessageId
    ? `${base}&target_message_id=${oldestMessageId}`
    : base;
}

export function normalizeChatMessages(payload) {
  return (payload?.messages || [])
    .filter(message => message?.id && !message?.deleted_at)
    .sort((a, b) => a.id - b.id);
}

export function mergeChatMessages(current, incoming) {
  const byId = new Map();
  [...current, ...incoming].forEach(message => {
    if (message?.id && !message?.deleted_at) byId.set(message.id, message);
  });
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function canSendToLounge(channel) {
  if (
    !channel ||
    channel.status === 'closed' ||
    channel.status === 'archived'
  ) {
    return false;
  }
  if (channel.meta?.user_silenced) return false;
  return Boolean(
    channel.current_user_membership || channel.meta?.can_join_chat_channel,
  );
}

export function loungeSendDisabledReason(channel) {
  if (!channel) return 'The Lounge channel is unavailable.';
  if (channel.status === 'closed' || channel.status === 'archived') {
    return 'The Lounge is currently read-only.';
  }
  if (channel.meta?.user_silenced) {
    return 'Your account cannot send chat messages right now.';
  }
  if (
    !channel.current_user_membership &&
    !channel.meta?.can_join_chat_channel
  ) {
    return 'Your account does not have permission to message the Lounge.';
  }
  return null;
}
