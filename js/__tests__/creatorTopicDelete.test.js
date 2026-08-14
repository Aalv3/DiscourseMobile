/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('creator discussion deletion contract', () => {
  test('does not infer ownership or substitute stock post deletion', () => {
    const source = read('product/NativeTopicScreen.js');
    expect(source).not.toContain('state.topic.user_id ===');
    expect(source).not.toContain('post.username === site.username');
    expect(source).toContain('payload?.can_creator_delete === true');
    expect(source).toContain(
      "site.jsonApi(`/posts/${post.id}.json`, 'DELETE')",
    );
    expect(source).toContain(
      "site.jsonApi(\n                `/native/v1/topics/${state.topic.id}`,\n                'DELETE'",
    );
  });

  test('confirmation names discussion and all replies', () => {
    const source = read('product/NativeTopicScreen.js');
    expect(source).toContain('Delete discussion?');
    expect(source).toContain(
      'This will remove your discussion and its replies from Adjuster Network.',
    );
    expect(source).toContain("{ text: 'Cancel', style: 'cancel' }");
    expect(source).toContain("style: 'destructive'");
  });

  test('invalidates shared lists before returning to Discussions', () => {
    const root = read('Discourse.js');
    const screens = read('product/ProductScreens.js');
    expect(root).toContain('memberContentVersion');
    expect(root).toContain('invalidateMemberContent');
    expect(screens).toContain('screenProps.memberContentVersion');
  });
});
