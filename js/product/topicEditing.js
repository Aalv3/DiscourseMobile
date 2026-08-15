/* @flow */
'use strict';

export function canEditPost(post) {
  return Boolean(post?.id && post.can_edit === true);
}

export async function loadEditablePost(site, post) {
  if (!canEditPost(post)) throw new Error('post_edit_not_authorized');
  if (typeof post.raw === 'string') return post.raw;
  const payload = await site.jsonApi(`/posts/${post.id}.json`);
  if (typeof payload?.raw !== 'string') {
    throw new Error('post_edit_source_unavailable');
  }
  return payload.raw;
}

export async function savePostEdit(site, postId, raw) {
  const value = String(raw || '').trim();
  if (!postId || !value) throw new Error('invalid_post_edit');
  return site.jsonApi(`/posts/${postId}.json`, 'PUT', {
    post: { raw: value },
  });
}
