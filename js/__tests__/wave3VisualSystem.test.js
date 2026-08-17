/* @flow */
'use strict';

import { productTheme, radius, spacing, type } from '../product/DesignSystem';

describe('Wave 3 product visual system', () => {
  test('light and dark themes expose the same semantic surface contract', () => {
    const light = productTheme('light');
    const dark = productTheme('dark');
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
    expect(light.canvas).not.toBe(dark.canvas);
    expect(light.text).not.toBe(dark.text);
    expect(light.accent).not.toBe(light.canvas);
    expect(dark.accent).not.toBe(dark.canvas);
  });

  test('shared density and type tokens preserve accessible geometry', () => {
    expect(spacing.md).toBeGreaterThanOrEqual(16);
    expect(radius.md).toBeLessThan(radius.lg);
    expect(type.body.lineHeight).toBeGreaterThan(type.body.fontSize);
    expect(type.metadata.lineHeight).toBeGreaterThan(type.metadata.fontSize);
  });

  test('screen source uses shared branded navigation and editorial rows', () => {
    const fs = require('fs');
    const components = fs.readFileSync(
      require.resolve('../product/ProductComponents'),
      'utf8',
    );
    const screens = fs.readFileSync(
      require.resolve('../product/ProductScreens'),
      'utf8',
    );
    expect(components).toContain('adjuster-network-logo.png');
    expect(components).toContain('NestedHeader');
    expect(screens).toContain('borderBottomWidth');
    expect(screens).toContain('Metadata');
  });

  test('Floor uses a real-topic horizontal attention rail instead of the large briefing hero', () => {
    const fs = require('fs');
    const screens = fs.readFileSync(
      require.resolve('../product/ProductScreens'),
      'utf8',
    );
    expect(screens).toContain('Worth your attention');
    expect(screens).toContain('horizontal');
    expect(screens).toContain('snapToInterval');
    expect(screens).toContain('data.topics.slice(0, 5)');
    expect(screens).not.toContain('FEATURED BRIEFING');
  });
});
