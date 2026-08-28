/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('first-party native surfaces', () => {
  test('Ask creates questions through the authenticated API', () => {
    const source = read('product/ProductScreens.js');
    const submission = read('product/AskSubmission.js');
    expect(submission).toContain("site.jsonApi('/posts.json', 'POST'");
    expect(source).toContain('submitAskQuestion({');
    expect(source).toContain('askableCategories(data.categories)');
    expect(source).toContain('accessibilityLabel="Question title"');
    expect(source).toContain("? 'Check posting status'");
    expect(source).not.toContain('Continue to private composer');
  });

  test('profiles load activity and save permitted fields natively', () => {
    const source = read('product/NativeProfileScreen.js');
    const dataSource = read('product/memberProfileData.js');
    expect(source).toContain('loadMemberProfileData(');
    expect(dataSource).toContain('site.jsonApi(`/u/${encoded}.json`)');
    expect(dataSource).toContain('cardPayload?.contributions || []');
    expect(dataSource).not.toContain('/user_actions.json');
    expect(dataSource).toContain("? '/native/v1/profile'");
    expect(dataSource).toContain('`/native/v1/profiles/${encoded}`');
    expect(source).toContain('saveAdjusterCardFields(');
    expect(source).toContain('card?.editable === true');
  });

  test('settings removes advanced web settings from Build 1', () => {
    const source = read('screens/SettingsScreen.js');
    expect(source).not.toContain('Advanced Settings');
    expect(source).not.toContain('WebView');
    expect(source).not.toContain('Linking.openURL');
  });
});
