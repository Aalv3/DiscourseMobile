/* @flow */
'use strict';

export const searchResults = payload => {
  const topics = Array.isArray(payload?.topics) ? payload.topics : [];
  const posts = Array.isArray(payload?.posts) ? payload.posts : [];
  const users = Array.isArray(payload?.users) ? payload.users : [];
  const topicById = new Map(topics.map(topic => [topic.id, topic]));

  return [
    ...posts.map(post => ({
      key: `post-${post.id}`,
      kind: 'post',
      title:
        topicById.get(post.topic_id)?.title ||
        post.topic_title ||
        'Discussion result',
      detail: post.blurb || post.username || 'Matching contribution',
      path: `/t/${topicById.get(post.topic_id)?.slug || 'topic'}/${
        post.topic_id
      }/${post.post_number || 1}`,
    })),
    ...topics
      .filter(topic => !posts.some(post => post.topic_id === topic.id))
      .map(topic => ({
        key: `topic-${topic.id}`,
        kind: 'topic',
        title: topic.title || 'Discussion',
        detail: `${topic.posts_count || 0} posts`,
        path: `/t/${topic.slug || 'topic'}/${topic.id}`,
      })),
    ...users.map(user => ({
      key: `user-${user.id || user.username}`,
      kind: 'user',
      title: user.name || user.username,
      detail: `@${user.username}`,
      path: `/u/${encodeURIComponent(user.username)}`,
    })),
  ];
};

export const supportedNotificationPreferences = userOption => [
  ...(Number.isInteger(userOption?.email_level)
    ? [
        {
          key: 'email_level',
          title: 'Topic activity email',
          value: userOption.email_level,
        },
      ]
    : []),
  ...(Number.isInteger(userOption?.email_messages_level)
    ? [
        {
          key: 'email_messages_level',
          title: 'Message email',
          value: userOption.email_messages_level,
        },
      ]
    : []),
  ...(typeof userOption?.email_digests === 'boolean'
    ? [
        {
          key: 'email_digests',
          title: 'Activity summary email',
          value: userOption.email_digests,
        },
      ]
    : []),
];

export const bookmarkDeletePath = bookmarkId =>
  `/bookmarks/${encodeURIComponent(bookmarkId)}.json`;
