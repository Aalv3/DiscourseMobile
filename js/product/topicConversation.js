/* @flow */
'use strict';

export function isDeletedPost(post) {
  if (post?.deleted_at || post?.user_deleted === true) return true;
  const cooked = String(post?.cooked || '').toLowerCase();
  return (
    cooked.includes('post deleted by author') ||
    cooked.includes('this post was deleted')
  );
}

export const visibleConversationPosts = posts =>
  Array.isArray(posts) ? posts.filter(post => !isDeletedPost(post)) : [];

export function conversationOrder(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  const byNumber = Object.fromEntries(
    posts.map(post => [post.post_number, post]),
  );
  const first = posts[0];
  const children = {};
  const detached = [];
  posts.slice(1).forEach(post => {
    const requestedParent = post.reply_to_post_number;
    const parentNumber = byNumber[requestedParent]
      ? requestedParent
      : first.post_number;
    if (!children[parentNumber]) children[parentNumber] = [];
    children[parentNumber].push(post);
  });
  const ordered = [];
  const visited = new Set();
  const visit = (post, depth) => {
    if (!post || visited.has(post.post_number)) return;
    visited.add(post.post_number);
    ordered.push({ post, depth });
    (children[post.post_number] || []).forEach(child =>
      visit(child, depth + 1),
    );
  };
  visit(first, 0);
  posts.forEach(post => {
    if (!visited.has(post.post_number)) detached.push(post);
  });
  detached.forEach(post => visit(post, 1));
  return ordered;
}
