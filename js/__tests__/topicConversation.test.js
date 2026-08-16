/* @flow */
'use strict';

import {
  conversationOrder,
  visibleConversationPosts,
} from '../product/topicConversation';

describe('topic conversation ordering', () => {
  test('places a targeted reply immediately beneath its parent', () => {
    const posts = [
      { id: 1, post_number: 1 },
      { id: 2, post_number: 2 },
      { id: 3, post_number: 3 },
      { id: 4, post_number: 4, reply_to_post_number: 2 },
    ];
    expect(conversationOrder(posts)).toEqual([
      { post: posts[0], depth: 0 },
      { post: posts[1], depth: 1 },
      { post: posts[3], depth: 2 },
      { post: posts[2], depth: 1 },
    ]);
  });

  test('groups multiple specific replies and preserves sibling order', () => {
    const posts = [
      { id: 1, post_number: 1 },
      { id: 2, post_number: 2 },
      { id: 3, post_number: 3, reply_to_post_number: 2 },
      { id: 4, post_number: 4, reply_to_post_number: 2 },
    ];
    expect(conversationOrder(posts).map(item => item.post.id)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  test('keeps deleted or unavailable parents visible without losing replies', () => {
    const posts = [
      { id: 1, post_number: 1 },
      { id: 5, post_number: 5, reply_to_post_number: 99 },
    ];
    expect(conversationOrder(posts)).toEqual([
      { post: posts[0], depth: 0 },
      { post: posts[1], depth: 1 },
    ]);
  });

  test('removes deleted tombstones while preserving surviving replies', () => {
    const posts = [
      { id: 1, post_number: 1, cooked: '<p>Original</p>' },
      {
        id: 2,
        post_number: 2,
        cooked: '<p>(post deleted by author)</p>',
        user_deleted: true,
      },
      {
        id: 3,
        post_number: 3,
        reply_to_post_number: 2,
        cooked: '<p>Surviving reply</p>',
      },
    ];
    const visible = visibleConversationPosts(posts);
    expect(visible.map(post => post.id)).toEqual([1, 3]);
    expect(conversationOrder(visible).map(item => item.post.id)).toEqual([
      1, 3,
    ]);
  });
});
