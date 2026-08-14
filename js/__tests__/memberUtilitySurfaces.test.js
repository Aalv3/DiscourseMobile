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

  test('search and bookmarks use authenticated APIs and native topic routing', () => {
    const source = read('product/NativeMemberUtilityScreens.js');
    expect(source).toContain('`/search.json?q=${encodeURIComponent(term)}`');
    expect(source).toContain('/activity/bookmarks.json`');
    expect(source).toContain('screenProps.openUrl(');
    expect(source).toContain('`${site.url}/t/');
    expect(source).not.toContain('WebView');
    expect(source).not.toContain('Linking.openURL');
  });

  test('privacy logout requires destructive confirmation', () => {
    const source = read('product/NativeMemberUtilityScreens.js');
    expect(source).toContain('Alert.alert(');
    expect(source).toContain("'Log out?'");
    expect(source).toContain("style: 'destructive'");
  });
});
