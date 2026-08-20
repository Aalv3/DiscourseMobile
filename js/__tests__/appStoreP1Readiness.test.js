/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

describe('App Store P1 source gates', () => {
  test('first launch truthfully describes invitation-only access', () => {
    const source = read('js/product/ProductScreens.js');
    expect(source).toContain('Invitation-only membership');
    expect(source).toContain('Member sign in');
    expect(source).toContain('Membership is currently available by invitation');
    expect(source).not.toContain('Connect free');
  });

  test('shipping target is iPhone only and declares no microphone purpose', () => {
    const project = read('ios/Discourse.xcodeproj/project.pbxproj');
    const info = read('ios/Discourse/Info.plist');
    expect(project).not.toContain('TARGETED_DEVICE_FAMILY = "1,2"');
    expect(project.match(/TARGETED_DEVICE_FAMILY = 1;/g)).toHaveLength(4);
    expect(info).not.toContain('NSMicrophoneUsageDescription');
  });

  test('canonical Jest discovery excludes regenerative local workspaces', () => {
    const config = read('jest.config.js');
    expect(config).toContain("'/.local/'");
    expect(config).toContain("modulePathIgnorePatterns: ['<rootDir>/.local/']");
  });

  test('topic and Lounge expose authenticated moderation actions', () => {
    const topic = read('js/product/NativeTopicScreen.js');
    const lounge = read('js/product/NativeLoungeScreen.js');
    expect(topic).toContain('reportPost(site, post.id)');
    expect(topic).toContain('blockMember(site, post.username)');
    expect(topic).toContain(
      'Replies from @${post.username} are now hidden. Their opening topics may still appear.',
    );
    expect(topic).not.toContain(
      'Content from @${post.username} is now hidden.',
    );
    expect(lounge).toContain(
      'reportChatMessage(site, chat.channel?.id, item.id)',
    );
    expect(lounge).toContain('blockMember(site, username)');
  });
});
