/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';
import {
  discussionSearchEligible,
  memberSearchResults,
  searchResults,
} from '../product/memberUtilities';

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('native member utility surfaces', () => {
  test('all visible settings rows navigate and Advanced is removed', () => {
    const source = read('screens/SettingsScreen.js');
    ['Account', 'Notifications', 'Appearance', 'Privacy & Account'].forEach(
      title => expect(source).toContain(`title="${title}"`),
    );
    expect(source).not.toContain('Advanced Settings');
    expect(source).toContain("navigation.navigate('Account')");
    expect(source).toContain("navigation.navigate('NotificationSettings')");
    expect(source).toContain("navigation.navigate('AppearanceSettings')");
    expect(source).toContain("navigation.navigate('PrivacyAccount')");
  });

  test('appearance defaults to light and supports persisted system, light, and dark choices', () => {
    const root = read('Discourse.js');
    const contracts = read('adjusterNetworkContracts.js');
    const screens = read('product/NativeMemberUtilityScreens.js');
    expect(root).toContain('@AdjusterNetwork.themePreference');
    expect(root).toContain("['system', 'light', 'dark']");
    expect(root).toContain("themePreference: 'light'");
    expect(root).toContain(": 'light';");
    expect(contracts).toContain("default: 'light'");
    expect(screens).toContain("['system', 'light', 'dark'].map");
    expect(screens).toContain('accessibilityState=');
  });

  test('notifications expose only server-returned supported preferences', () => {
    const source = read('product/NativeMemberUtilityScreens.js');
    expect(source).toContain('supportedNotificationPreferences');
    expect(source).toContain("['Always', 0]");
    expect(source).toContain("['On', true]");
  });

  test('search and bookmarks use authenticated APIs and native topic routing', () => {
    const source = read('product/NativeMemberUtilityScreens.js');
    expect(source).toContain('`/search.json?q=${encodeURIComponent(term)}`');
    expect(source).toContain('/activity/bookmarks.json`');
    expect(source).toContain('screenProps.openUrl(');
    expect(source).toContain('searchResults(contentResponse.value)');
    expect(source).toContain('/native/v1/member-search?q=');
    expect(source).toContain('memberSearchResults(memberResponse.value)');
    expect(source).toContain("['members', 'Members']");
    expect(source).toContain('Open ${member.title} Adjuster Card');
    expect(source).toContain('bookmarkDeletePath(item.id)');
    expect(source).not.toContain('WebView');
  });

  test.each([
    ['qa', false],
    ['QA', false],
    ['reviewer', true],
    ['admin', true],
    ['roof', true],
  ])('discussion search eligibility for %s is %s', (query, expected) => {
    expect(discussionSearchEligible(query)).toBe(expected);
  });

  test('a two-character member query can return the normal empty state', () => {
    expect(searchResults({ topics: [], posts: [], users: [] })).toEqual([]);
    expect(
      memberSearchResults({ schema: 'an.member-search.v1', results: [] }),
    ).toEqual([]);
  });

  test('member search uses only contract-returned professional metadata', () => {
    const helper = read('product/memberUtilities.js');
    expect(helper).toContain("payload?.schema !== 'an.member-search.v1'");
    expect(helper).toContain(
      'professional_headline: metadata.professional_headline',
    );
    expect(helper).toContain('licensed_states: metadata.licensed_states');
    expect(helper).not.toContain('metadata.email');
    expect(helper).not.toContain('metadata.phone');
    expect(helper).not.toContain('metadata.resume');
  });

  test('privacy actions use authenticated export and in-app account deletion', () => {
    const source = read('product/NativeMemberUtilityScreens.js');
    const moderation = read('product/NativeModeration.js');
    expect(source).toContain('/export_csv/export_entity.json');
    expect(source).toContain("entity: 'user_archive'");
    expect(source).toContain("'Delete your account?'");
    expect(source).toContain('await deleteOwnAccount(site)');
    expect(moderation).toContain('`/u/${encodeURIComponent(username)}.json`');
    expect(source).not.toContain('mailto:');
    expect(source).toContain('https://adjusternetwork.org/privacy');
    expect(source).toContain('https://adjusternetwork.org/tos');
    expect(source).toContain('https://adjusternetwork.org/guidelines');
    expect(source).toContain('https://adjusternetwork.org/support');
  });

  test('privacy logout requires destructive confirmation', () => {
    const source = read('product/NativeMemberUtilityScreens.js');
    expect(source).toContain('Alert.alert(');
    expect(source).toContain("'Log out?'");
    expect(source).toContain("style: 'destructive'");
  });
});
