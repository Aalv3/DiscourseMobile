/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('first-party native surfaces', () => {
  test('Ask creates questions through the authenticated API', () => {
    const source = read('product/ProductScreens.js');
    expect(source).toContain("site.jsonApi('/posts.json', 'POST'");
    expect(source).toContain('accessibilityLabel="Question title"');
    expect(source).toContain("label={question.submitting ? 'Posting…' : 'Ask the Network'}");
    expect(source).not.toContain('Continue to private composer');
  });

  test('profiles load activity and save permitted fields natively', () => {
    const source = read('product/NativeProfileScreen.js');
    expect(source).toContain('site.jsonApi(`/u/${encodeURIComponent(username)}.json`)');
    expect(source).toContain("filter=4,5");
    expect(source).toContain("'PUT'");
    expect(source).toContain('user?.can_edit === true');
  });

  test('settings deliberately defers advanced web settings', () => {
    const source = read('screens/SettingsScreen.js');
    expect(source).toContain('Advanced Settings');
    expect(source).toContain('Deferred for Build 1');
    expect(source).not.toContain('WebView');
    expect(source).not.toContain('Linking.openURL');
  });
});
