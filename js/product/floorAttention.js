/* @flow */
'use strict';

export const floorAttentionState = topic => {
  if (topic?.an_network_activity_class === 'owner_editorial') {
    return { label: 'OFFICIAL', icon: 'bullhorn', needsReply: false };
  }
  const replies = Math.max(0, (topic?.posts_count || 1) - 1);
  if (
    topic?.an_network_activity_class === 'member_activity' &&
    replies === 0
  ) {
    return { label: 'NEEDS A REPLY', icon: 'question', needsReply: true };
  }
  return { label: 'ACTIVE', icon: 'comments', needsReply: false };
};
