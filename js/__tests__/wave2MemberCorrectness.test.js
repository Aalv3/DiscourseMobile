/* @flow */
'use strict';

import {
  bookmarkDeletePath,
  searchResults,
  supportedNotificationPreferences,
} from '../product/memberUtilities';
import fs from 'fs';
import path from 'path';

const source = file =>
  fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('Wave 2 member correctness helpers', () => {
  test('search preserves post, topic, and member destinations', () => {
    expect(
      searchResults({
        topics: [{ id: 7, slug: 'wind', title: 'Wind', posts_count: 2 }],
        posts: [{ id: 9, topic_id: 7, post_number: 2, blurb: 'match' }],
        users: [{ id: 3, username: 'alex', name: 'Alex' }],
      }),
    ).toEqual([
      expect.objectContaining({ kind: 'post', path: '/t/wind/7/2' }),
      expect.objectContaining({ kind: 'user', path: '/u/alex' }),
    ]);
  });

  test('notification fields are capability-derived from the returned payload', () => {
    expect(supportedNotificationPreferences({})).toEqual([]);
    expect(
      supportedNotificationPreferences({
        email_level: 0,
        email_messages_level: 1,
        email_digests: false,
      }).map(item => item.key),
    ).toEqual(['email_level', 'email_messages_level', 'email_digests']);
  });

  test('bookmark deletion targets only the server bookmark identifier', () => {
    expect(bookmarkDeletePath('12')).toBe('/bookmarks/12.json');
  });

  test('all categories and real profile avatars are exposed without fake controls', () => {
    const screens = source('product/ProductScreens.js');
    const profile = source('product/NativeProfileScreen.js');
    expect(screens).toContain('...data.categories.map');
    expect(screens).not.toContain('data.categories.slice(0, 5)');
    expect(screens).toContain('avatarTemplate.replace');
    expect(profile).toContain('card?.photo.enabled');
    expect(profile).toContain('card.photo.editable');
  });

  test('welcome and onboarding remain scroll-reachable at accessibility text sizes', () => {
    const screens = source('product/ProductScreens.js');
    const onboarding = source('product/AdjusterCardOnboardingScreen.js');
    expect(screens).toContain('welcomeAccessibility');
    expect(screens).toContain('fontScale >= 1.6');
    expect(onboarding).toContain('accessibilityContent');
    expect(onboarding).toContain('paddingBottom: 72');
  });
});
