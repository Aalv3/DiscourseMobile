jest.mock('@react-native-vector-icons/fontawesome5', () => 'FontAwesome5');

import React from 'react';
import renderer from 'react-test-renderer';
import {
  authRedirectForChannel,
  authSchemeForChannel,
  canonicalOriginForChannel,
  isPreviewChannel,
  mediaUploadsEnabledForChannelSite,
  trustedUpdateChannel,
} from '../adjusterNetworkConfig';
import PreviewBanner, { PREVIEW_LABEL } from '../product/PreviewBanner';

const PRODUCTION = 'https://adjusternetwork.org';
const STAGING = 'https://staging.adjusternetwork.org';

describe('channel to origin mapping', () => {
  test('preview points at the real production origin', () => {
    expect(canonicalOriginForChannel('preview')).toBe(PRODUCTION);
    expect(canonicalOriginForChannel('production')).toBe(PRODUCTION);
    expect(canonicalOriginForChannel('staging')).toBe(STAGING);
  });

  test('preview and production are the same server, deliberately', () => {
    expect(canonicalOriginForChannel('preview')).toBe(
      canonicalOriginForChannel('production'),
    );
  });

  test('an unknown channel still has no origin', () => {
    for (const channel of [null, undefined, '', 'dev', 'PREVIEW', 'prod']) {
      expect(trustedUpdateChannel(channel)).toBeNull();
      expect(
        canonicalOriginForChannel(trustedUpdateChannel(channel)),
      ).toBeNull();
    }
  });

  test('preview is a trusted channel so product features stay enabled', () => {
    expect(trustedUpdateChannel('preview')).toBe('preview');
    // Preview must behave like production, including media, or it validates
    // something other than what ships.
    expect(
      mediaUploadsEnabledForChannelSite('preview', { url: PRODUCTION }),
    ).toBe(true);
    expect(mediaUploadsEnabledForChannelSite('preview', { url: STAGING })).toBe(
      false,
    );
  });
});

describe('preview cannot claim production identity', () => {
  test('the URL scheme differs', () => {
    expect(authSchemeForChannel('preview')).toBe('anpreview');
    expect(authSchemeForChannel('production')).toBe('adjusternetwork');
    expect(authSchemeForChannel('staging')).toBe('adjusternetwork');
    expect(authSchemeForChannel('preview')).not.toBe(
      authSchemeForChannel('production'),
    );
  });

  test('the auth redirect differs and stays exact', () => {
    expect(authRedirectForChannel('preview')).toBe(
      'anpreview://adjusternetwork.org/auth_redirect',
    );
    expect(authRedirectForChannel('production')).toBe(
      'adjusternetwork://adjusternetwork.org/auth_redirect',
    );
    for (const channel of ['preview', 'production', 'staging']) {
      expect(authRedirectForChannel(channel)).not.toContain('*');
    }
  });

  test('production and staging redirects are unchanged by the preview work', () => {
    // Regression guard: the shipped value the server already allows.
    expect(authRedirectForChannel('production')).toBe(
      'adjusternetwork://adjusternetwork.org/auth_redirect',
    );
    expect(authRedirectForChannel('staging')).toBe(
      'adjusternetwork://adjusternetwork.org/auth_redirect',
    );
  });

  test('isPreviewChannel is exact', () => {
    expect(isPreviewChannel('preview')).toBe(true);
    for (const channel of ['production', 'staging', null, 'Preview']) {
      expect(isPreviewChannel(channel)).toBe(false);
    }
  });
});

describe('the PREVIEW marker', () => {
  const render = channel => {
    let tree;
    renderer.act(() => {
      tree = renderer.create(<PreviewBanner channel={channel} />);
    });
    return tree;
  };

  test('shows on preview', () => {
    expect(JSON.stringify(render('preview').toJSON())).toContain(PREVIEW_LABEL);
  });

  test('never shows on production or staging', () => {
    for (const channel of ['production', 'staging', null, undefined]) {
      expect(render(channel).toJSON()).toBeNull();
    }
  });

  test('cannot intercept touches or alter behaviour', () => {
    const root = render('preview').root;
    // The composite and its host node both carry the prop; what matters is
    // that the marker is non-interactive, not how many nodes report it.
    const strip = root.findAll(node => node.props.pointerEvents === 'none');
    expect(strip.length).toBeGreaterThanOrEqual(1);
    // No interactive handler anywhere in the marker.
    expect(
      root.findAll(node => typeof node.props.onPress === 'function'),
    ).toHaveLength(0);
  });
});

describe('native and config wiring', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..', '..');
  const read = f => fs.readFileSync(path.join(root, f), 'utf8');

  test('the build phase compiles preview and still fails closed', () => {
    const project = read('ios/Discourse.xcodeproj/project.pbxproj');
    expect(project).toContain('preview) embedded=true');
    expect(project).toContain('staging) embedded=false');
    expect(project).toContain('production) embedded=true');
    expect(project).toContain('invalid Adjuster Network OTA channel');
  });

  test('preview has its own bundle id, scheme, group and entitlements', () => {
    const project = read('ios/Discourse.xcodeproj/project.pbxproj');
    expect(project).toContain(
      'PRODUCT_BUNDLE_IDENTIFIER = org.adjusternetwork.app.preview;',
    );
    expect(project).toContain(
      'PRODUCT_BUNDLE_IDENTIFIER = org.adjusternetwork.app.preview.ShareExtension;',
    );
    expect(project).toContain('AN_URL_SCHEME = anpreview;');
    expect(project).toContain('AN_DISPLAY_NAME = "AN Preview";');
    expect(project).toContain('AN_OTA_CHANNEL = preview;');
    // Production identity is untouched.
    expect(project).toContain(
      'PRODUCT_BUNDLE_IDENTIFIER = org.adjusternetwork.app;',
    );
    expect(project).toContain('AN_URL_SCHEME = adjusternetwork;');
  });

  test('preview uses a separate app group, so no shared container', () => {
    const preview = read('ios/Discourse/Discourse.preview.entitlements');
    expect(preview).toContain('group.org.adjusternetwork.preview');
    expect(preview).not.toContain(
      '<string>group.org.adjusternetwork.app</string>',
    );
    // V1 carries neither push nor associated domains.
    // Match the declared keys, not the explanatory comment that names them.
    expect(preview).not.toContain('<key>aps-environment</key>');
    expect(preview).not.toContain(
      '<key>com.apple.developer.associated-domains</key>',
    );
    // Production entitlements are unchanged.
    const production = read('ios/Discourse/Discourse.entitlements');
    expect(production).toContain('group.org.adjusternetwork.app');
    expect(production).toContain('aps-environment');
    expect(production).toContain('applinks:adjusternetwork.org');
  });

  test('preview does not register a push device in V1', () => {
    expect(read('js/adjusterNetworkConfig.js')).toContain(
      'pushDelivery: !isPreviewChannel(updateChannel)',
    );
  });

  test('the eas preview profile targets the preview channel only', () => {
    const eas = JSON.parse(read('eas.json'));
    expect(eas.build.preview.channel).toBe('preview');
    expect(eas.build.preview.env.AN_OTA_CHANNEL).toBe('preview');
    expect(eas.build.preview.ios.buildConfiguration).toBe('Preview');
    expect(eas.build.preview.distribution).toBe('internal');
    // The other lanes are untouched.
    expect(eas.build.production.channel).toBe('production');
    expect(eas.build.staging.channel).toBe('staging');
  });

  test('no runtime switch can change a binary channel', () => {
    const config = read('js/adjusterNetworkConfig.js');
    // The channel comes from expo-updates, which reads the compiled-in header.
    expect(config).toContain('trustedUpdateChannel(Updates.channel)');
    // Nothing writes it.
    expect(config).not.toMatch(/setChannel|channel\s*=\s*['"]preview['"]/);
  });
});
