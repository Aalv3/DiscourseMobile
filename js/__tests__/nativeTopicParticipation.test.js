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
    expect(source).toContain(
      'reply_to_post_number: composer.replyToPostNumber',
    );
    for (const scope of [
      "'read'",
      "'write'",
      "'notifications'",
      "'session_info'",
      "'one_time_password'",
      "'adjuster-network-renaissance:member_discovery'",
      "'adjuster-network-renaissance:profile_onboarding'",
      "'adjuster-network-renaissance:creator_delete'",
      'ADMISSION_HANDOFF_SCOPE',
    ]) {
      expect(siteManagerSource).toContain(scope);
    }
  });

  test('provides an accessible native composer and refreshes after posting', () => {
    expect(source).toContain('label="Write a reply"');
    expect(source).toContain('accessibilityLabel="Reply text"');
    expect(source).toContain("'Posting…'");
    expect(source).toContain("'Post reply'");
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
    expect(source).toContain(
      "site.jsonApi(`/posts/${post.id}.json`, 'DELETE')",
    );
  });

  test('edits only posts Guardian marks editable and refreshes the thread', () => {
    expect(source).toContain('canEditPost(post)');
    expect(source).toContain('loadEditablePost(site, post)');
    expect(source).toContain(
      'savePostEdit(site, composer.postId, submittedRaw)',
    );
    expect(source).toContain("? 'Save changes'");
    expect(source).toContain('await loadTopic();');
  });

  test('keeps creator-topic deletion separate behind backend capability', () => {
    expect(source).toContain(
      '`/native/v1/topics/${route.params.topicId}/capabilities`',
    );
    expect(source).toContain('payload?.can_creator_delete === true');
    expect(source).toContain('creatorDelete.allowed');
    expect(source).toContain('label="Delete discussion"');
    expect(source).toContain("'Delete discussion?'");
    expect(source).toContain('`/native/v1/topics/${state.topic.id}`');
    expect(source).toContain("'DELETE'");
    expect(source).toContain('error?.status === 404');
    expect(source).toContain('screenProps.invalidateMemberContent()');
    expect(source).toContain("screen: 'Discussions'");
  });

  test('does not present tombstone-inclusive list aggregates as replies', () => {
    const screens = fs.readFileSync(
      path.join(__dirname, '../product/ProductScreens.js'),
      'utf8',
    );
    expect(screens).toContain('Math.max(0, (topic.posts_count || 1) - 1)');
    expect(screens).toContain('`${replies} replies`');
    expect(screens).not.toContain('topic.posts_count || 0} replies');
  });
});
