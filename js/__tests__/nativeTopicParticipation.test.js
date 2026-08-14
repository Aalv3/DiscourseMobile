/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.join(__dirname, '../product/NativeTopicScreen.js'),
  'utf8',
);
const siteManagerSource = fs.readFileSync(
  path.join(__dirname, '../site_manager.js'),
  'utf8',
);

describe('native topic participation', () => {
  test('uses the authenticated Discourse create-post endpoint', () => {
    expect(source).toContain("site.jsonApi('/posts.json', 'POST'");
    expect(source).toContain('topic_id: state.topic.id');
    expect(source).toContain('reply_to_post_number: composer.replyToPostNumber');
    expect(siteManagerSource).toContain(
      "'read,write,notifications,session_info,one_time_password'",
    );
  });

  test('provides an accessible native composer and refreshes after posting', () => {
    expect(source).toContain('label="Join discussion"');
    expect(source).toContain('accessibilityLabel="Reply text"');
    expect(source).toContain("label={composer.submitting ? 'Posting…' : 'Post reply'}");
    expect(source).toContain('await loadTopic();');
  });

  test('respects server topic permissions and preserves safety guidance', () => {
    expect(source).toContain('topic?.details?.can_create_post !== true');
    expect(source).toContain('topic?.closed');
    expect(source).toContain('topic?.archived');
    expect(source).toContain('Keep claim data out.');
  });

  test('renders truthful safe mutation errors without logging response data', () => {
    expect(source).toContain('error?.status === 403');
    expect(source).toContain('error?.status === 422');
    expect(source).toContain('error.userMessages.join');
    expect(source).not.toContain('console.log');
  });

  test('renders persisted reply relationships and member identity', () => {
    expect(source).toContain('post.reply_to_post_number');
    expect(source).toContain('postsByNumber[post.reply_to_post_number]');
    expect(source).toContain('Replying to');
    expect(source).toContain('post?.avatar_template');
    expect(source).toContain('post.created_at');
    expect(source).toContain('jumpToPost(post.reply_to_post_number)');
  });

  test('shows the specific target before submit and permits changing it', () => {
    expect(source).toContain('`Replying to ${memberName(replyTarget)}`');
    expect(source).toContain('compactExcerpt(replyTarget)');
    expect(source).toContain('Change to topic-level reply');
    expect(source).toContain('replyToPostNumber: null');
  });

  test('exposes delete only when Guardian authorizes it', () => {
    expect(source).toContain('post.can_delete');
    expect(source).toContain("site.jsonApi(`/posts/${post.id}.json`, 'DELETE')");
  });

  test('does not present tombstone-inclusive list aggregates as replies', () => {
    const screens = fs.readFileSync(
      path.join(__dirname, '../product/ProductScreens.js'),
      'utf8',
    );
    expect(screens).toContain('Open conversation ·');
    expect(screens).not.toContain('topic.posts_count || 0} replies');
  });
});
