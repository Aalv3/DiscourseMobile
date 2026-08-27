/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Wave 1 native boundaries', () => {
  test('pins staging pods to the SDK 54 Xcode 16.4 build image', () => {
    const eas = JSON.parse(read('eas.json'));
    expect(eas.build.staging.ios.image).toBe('macos-sequoia-15.6-xcode-16.4');
    expect(eas.build.staging.ios.cocoapods).toBe('1.17.0');
    expect(eas.build.staging.channel).toBe('staging');
    expect(eas.build.staging.distribution).toBe('internal');
    expect(eas.build.production.ios).toBeUndefined();
  });

  test('pairs APNs and backend environments to trusted build configurations', () => {
    const project = read('ios/Discourse.xcodeproj/project.pbxproj');
    const entitlements = read('ios/Discourse/Discourse.entitlements');
    const developmentEntitlements = read(
      'ios/Discourse/Discourse.development.entitlements',
    );
    const info = read('ios/Discourse/Info.plist');
    const nativeModule = read('ios/DiscourseKeyboardShortcuts.m');
    expect(project).toContain('AN_PUSH_ENVIRONMENT = staging;');
    expect(project).toContain('AN_PUSH_ENVIRONMENT = production;');
    expect(project).toContain(
      'CODE_SIGN_ENTITLEMENTS = Discourse/Discourse.development.entitlements;',
    );
    expect(project).toContain(
      'CODE_SIGN_ENTITLEMENTS = Discourse/Discourse.entitlements;',
    );
    expect(developmentEntitlements).toContain('<string>development</string>');
    expect(entitlements).toContain('<string>production</string>');
    expect(developmentEntitlements).not.toContain('$(');
    expect(entitlements).not.toContain('$(');
    expect(info).toContain('$(AN_PUSH_ENVIRONMENT)');
    expect(nativeModule).toContain('@"pushEnvironment"');
    expect(nativeModule).not.toMatch(
      /apsEnvironment|embedded\.mobileprovision|NSISOLatin1StringEncoding|SecTask|profileData|profilePath/,
    );
  });

  test('enforces production APNs identity on the final archive only', () => {
    const readiness = read('scripts/verify-native-release-readiness.mjs');
    expect(readiness).toContain('signedEntitlements(app)');
    expect(readiness).toContain(
      "hasStringValue(appEntitlements, 'aps-environment', 'production')",
    );
    expect(readiness).toContain(
      "plistValue(`${app}/Info.plist`, 'ANPushEnvironment') === 'production'",
    );
    expect(readiness).toContain(
      "plistValue(`${app}/Info.plist`, 'CFBundleIdentifier')",
    );
    expect(readiness).toContain(
      "!hasTrueValue(appEntitlements, 'get-task-allow')",
    );
    expect(readiness).toContain('Adjuster Network App Store');
    expect(readiness).toContain('Adjuster Network Share Extension App Store');
  });

  test('uses one explicit App Group without sharing credentials', () => {
    const main = read('ios/Discourse/Discourse.entitlements');
    const extension = read('ios/ShareExtension/ShareExtension.entitlements');
    const source = read('ios/ShareExtension/ShareViewController.swift');
    for (const value of [main, extension, source]) {
      expect(value).toContain('group.org.adjusternetwork.app');
    }
    expect(source).toContain('an.share-intent.v1');
    expect(source).toContain('.completeFileProtection');
    expect(source).toContain('extensionContext?.open(callback)');
    expect(source).not.toMatch(/authToken|User-Api-Key|clientId|credential/i);
    expect(source).not.toContain('UIApplication.shared');
  });

  test('accepts one bounded image through a protected one-shot handoff', () => {
    const plist = read('ios/ShareExtension/Info.plist');
    const extension = read('ios/ShareExtension/ShareViewController.swift');
    const nativeModule = read('ios/DiscourseKeyboardShortcuts.m');
    const app = read('js/Discourse.js');
    const composer = read('js/product/AttachmentComposer.js');
    expect(plist).toContain('NSExtensionActivationSupportsImageWithMaxCount');
    expect(plist).toMatch(
      /NSExtensionActivationSupportsImageWithMaxCount<\/key>\s*<integer>1<\/integer>/,
    );
    expect(extension).toContain('15 * 1024 * 1024');
    expect(extension).toContain('loadFileRepresentation');
    expect(extension).toContain(
      'completeFileProtectionUntilFirstUserAuthentication',
    );
    expect(extension).not.toMatch(/PHAsset|assets-library:/);
    expect(nativeModule).toContain('discardSharedImage');
    expect(nativeModule).toContain('ANRemoveExpiredSharedImages');
    expect(nativeModule).toContain('actualSize <= 15 * 1024 * 1024');
    expect(app).toContain("intent.kind === 'image'");
    expect(composer).toContain('discardSharedAsset');
  });

  test('consumes and deletes bounded shared payload before authenticated routing', () => {
    const nativeModule = read('ios/DiscourseKeyboardShortcuts.m');
    const app = read('js/Discourse.js');
    expect(nativeModule).toContain('consumeShareIntent');
    expect(nativeModule).toContain('removeItemAtURL:file');
    expect(nativeModule).toContain('data.length > 4096');
    expect(nativeModule).toContain('age <= 300');
    expect(nativeModule).toContain('adjusternetwork.org');
    expect(app).toContain("event.url === 'adjusternetwork://share'");
    expect(app).toContain('async _consumeShareIntent()');
    expect(app).toContain('candidate => candidate.authToken');
    expect(app).not.toContain('if (params.sharedUrl)');
  });
});
