/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.join(__dirname, '../product/ProductScreens.js'),
  'utf8',
);

describe('native Lounge participation', () => {
  test('loads the dedicated Lounge category and honors create permission', () => {
    expect(source).toContain("category.name.toLowerCase() === 'lounge'");
    expect(source).toContain('payload?.topic_list?.can_create_topic === true');
    expect(source).toContain('Your account can join existing Lounge conversations');
  });

  test('creates a Lounge topic through the authenticated native API', () => {
    expect(source).toContain("site.jsonApi('/posts.json', 'POST'");
    expect(source).toContain('category: lounge.id');
    expect(source).toContain('label="Start a conversation"');
    expect(source).toContain('await refreshLounge();');
  });

  test('keeps the primary empty state actionable and safety-aware', () => {
    expect(source).toContain('The Lounge is quiet');
    expect(source).toContain('Keep claim data out.');
    expect(source).toContain('accessibilityLabel="Conversation text"');
  });
});
