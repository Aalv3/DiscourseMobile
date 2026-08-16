/* @flow */
'use strict';

const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('authenticated member shell', () => {
  test('all six primary destinations use the shared branded page header', () => {
    const source = [
      read('product/ProductScreens.js'),
      read('product/NativeLoungeScreen.js'),
    ].join('\n');
    const titles = [
      'The Floor',
      'Discussions',
      'The Lounge',
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
    expect(source).toContain('maxFontSizeMultiplier={1.35}');
    expect(source).not.toContain(
      '>\n            ADJUSTER NETWORK\n          </Text>',
    );
  });

  test('all six primary destinations expose the native notification center', () => {
    const primary = read('product/ProductScreens.js');
    const lounge = read('product/NativeLoungeScreen.js');
    const root = read('Discourse.js');
    expect((primary.match(/<HeaderActions/g) || []).length).toBe(5);
    expect(lounge).toContain('<NotificationBell');
    expect(root).toContain('name="NotificationCenter"');
    expect(root).toContain('nativeMemberShell');
  });

  test('nested pages share an accessible solid-chevron back header', () => {
    const source = read('product/ProductComponents.js');
    const topic = read('product/NativeTopicScreen.js');
    const webView = read('screens/WebViewScreenComponents/WebViewComponent.js');

    expect(source).toContain('export const NestedHeader');
    expect(source).toContain('name="chevron-left"');
    expect(source).toContain('iconStyle="solid"');
    expect(source).toContain('accessibilityHint=');
    expect(topic).toContain('<NestedHeader');
    expect(webView).toContain('<NestedHeader');
    expect(read('Discourse.js')).toContain("<SafeAreaView edges={['top']}>");
  });

  test('root owns a themed safe-area and navigation surface', () => {
    const source = read('Discourse.js');

    expect(source).toContain('<SafeAreaProvider');
    expect(source).toContain('backgroundColor: shellColors.canvas');
    expect(source).toContain('theme={navigationTheme}');
    expect(source).toContain('translucent={false}');
    expect(source).toContain('tabBarHideOnKeyboard: true');
  });

  test('member account rows use supported semantic glyphs', () => {
    const source = read('product/ProductScreens.js');
    const glyphs = require('../../node_modules/@react-native-vector-icons/fontawesome5/glyphmaps/FontAwesome5_solid.json');

    expect(glyphs.cog).toBeDefined();
    expect(source).toContain('icon="cog"');
    expect(source).not.toContain('icon="gear"');
    expect(source).not.toContain('? Back');
  });

  test('successful notification preference restores through registration', () => {
    const source = read('Discourse.js');
    expect(source).toMatch(/this\._pushFoundation\s*\.status\(\)/);
    expect(source).toContain("if (preference !== 'enabled') return;");
    expect(source).toContain('this._pushFoundation.enable(site)');
  });
});
