/* @flow */
'use strict';

const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('authenticated member shell', () => {
  test('all six primary destinations use the branded member shell', () => {
    const source = [
      read('product/ProductScreens.js'),
      read('product/NativeLoungeScreen.js'),
    ].join('\n');
    expect(source).toContain('title="Lounge"');
    ['Ask the Network', 'Intelligence', 'You'].forEach(title => {
      expect(source).toContain(title);
    });
    expect((source.match(/<FloorHeader/g) || []).length).toBe(5);
    expect(source).toContain('<V2BrandHeader');
    expect(source).toContain('>\n          Discussions\n        </Text>');
    expect(source).toContain('adjuster-network-logo.png');
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
    expect((primary.match(/<FloorHeader/g) || []).length).toBe(5);
    expect(lounge).toContain('onNotifications={() =>');
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

  test('elevated Ask action preserves the shared tab-label baseline', () => {
    const source = read('Discourse.js');
    const askOptions = source.slice(
      source.indexOf('name="Ask"'),
      source.indexOf('name="Lounge"'),
    );

    expect(askOptions).toContain('width: 38');
    expect(askOptions).toContain('height: 38');
    expect(askOptions).toContain('transform: [{ translateY: -10 }]');
    expect(askOptions).not.toContain('marginTop: -6');

    // The six fixed-width destinations retain side clearance around the
    // 38-point action at the smallest supported portrait width and both
    // current Pro widths.
    [375, 393, 402].forEach(viewportWidth => {
      const tabSlotWidth = (viewportWidth - 20) / 6;
      expect(tabSlotWidth - 38).toBeGreaterThanOrEqual(21);
    });

    // React Navigation reserves the label at the bottom of the item. The
    // visual-only lift leaves the label in that shared slot and provides a
    // conservative minimum gap in standard and Larger UI modes.
    [
      { barHeight: 70, labelBlockHeight: 15 },
      { barHeight: 76, labelBlockHeight: 19 },
    ].forEach(({ barHeight, labelBlockHeight }) => {
      const iconAreaHeight = barHeight - 7 - labelBlockHeight;
      const circleBottom = iconAreaHeight / 2 + 38 / 2 - 10;
      expect(iconAreaHeight - circleBottom).toBeGreaterThanOrEqual(15);
    });
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

  test('startup and manual push registration preserve safe failure categories', () => {
    const source = read('Discourse.js');
    expect(source.match(/resultFromPushError\(/g)).toHaveLength(3);
    expect(source).toContain('pushAttemptResult: started');
    expect(source).toContain('recordPushRegistrationResult(started)');
    expect(source).not.toContain(
      "this.setState({ pushStatus: 'push_registration_failed' })",
    );
  });
});
