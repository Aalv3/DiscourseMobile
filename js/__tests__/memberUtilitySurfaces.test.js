/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

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

  test('appearance supports persisted system, light, and dark choices', () => {
    const root = read('Discourse.js');
    const screens = read('product/NativeMemberUtilityScreens.js');
    expect(root).toContain('@AdjusterNetwork.themePreference');
    expect(root).toContain("['system', 'light', 'dark']");
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

  test('privacy actions are confirmed and use authenticated export plus reviewed deletion', () => {
    const source = read('product/NativeMemberUtilityScreens.js');
    expect(source).toContain('/export_csv/export_entity.json');
    expect(source).toContain("entity: 'user_archive'");
    expect(source).toContain('privacy@adjusternetwork.org');
    expect(source).toContain("'Request account deletion?'");
  });

  test('privacy logout requires destructive confirmation', () => {
    const source = read('product/NativeMemberUtilityScreens.js');
    expect(source).toContain('Alert.alert(');
    expect(source).toContain("'Log out?'");
    expect(source).toContain("style: 'destructive'");
  });
});
