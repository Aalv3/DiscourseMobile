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
});
