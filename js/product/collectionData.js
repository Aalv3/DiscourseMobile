/* @flow */
'use strict';

export function collectionTopics(payload) {
  const topics = payload?.topic_list?.topics || payload?.topics || [];
  return Array.isArray(topics) ? topics : [];
}
