/* @flow */
'use strict';

const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('authenticated member shell', () => {
  test('all six primary destinations use the shared branded page header', () => {
    const source = read('product/ProductScreens.js');
    const titles = [
      'The Floor',
      'Discussions',
      'Lounge',
      'Ask the Network',
      'Intelligence',
      'You',
    ];

    titles.forEach(title => {
      expect(source).toContain(`title="${title}"`);
    });
    expect((source.match(/<PageHeader/g) || []).length).toBe(6);
  });

  test('shared header uses the canonical mark and bounded type scaling', () => {
    const source = read('product/ProductComponents.js');

    expect(source).toContain('adjuster-network-logo.png');
    expect(source).toContain('accessibilityLabel="Adjuster Network"');
    expect(source).toContain('maxFontSizeMultiplier={1.2}');
    expect(source).toContain('maxFontSizeMultiplier={1.35}');
  });

  test('root owns a themed safe-area and navigation surface', () => {
    const source = read('Discourse.js');

    expect(source).toContain('<SafeAreaProvider');
    expect(source).toContain('backgroundColor: shellColors.canvas');
    expect(source).toContain('theme={navigationTheme}');
    expect(source).toContain('translucent={false}');
  });
});
