/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Wave 1 native boundaries', () => {
  test('pairs APNs and backend environments to trusted build configurations', () => {
    const project = read('ios/Discourse.xcodeproj/project.pbxproj');
    const entitlements = read('ios/Discourse/Discourse.entitlements');
    const info = read('ios/Discourse/Info.plist');
    const nativeModule = read('ios/DiscourseKeyboardShortcuts.m');
    expect(project).toContain('AN_APNS_ENVIRONMENT = development;');
    expect(project).toContain('AN_PUSH_ENVIRONMENT = staging;');
    expect(project).toContain('AN_APNS_ENVIRONMENT = production;');
    expect(project).toContain('AN_PUSH_ENVIRONMENT = production;');
    expect(entitlements).toContain('$(AN_APNS_ENVIRONMENT)');
    expect(info).toContain('$(AN_PUSH_ENVIRONMENT)');
    expect(nativeModule).toContain('@"pushEnvironment"');
    expect(nativeModule).toContain('@"apsEnvironment"');
    expect(nativeModule).toContain('SecTaskCreateFromSelf');
    expect(nativeModule).toContain('SecTaskCopyValueForEntitlement');
    expect(nativeModule).toContain('CFSTR("aps-environment")');
    expect(nativeModule).toContain(
      'CFGetTypeID(entitlement) != CFStringGetTypeID()',
    );
    expect(nativeModule).toContain('isEqualToString:@"development"');
    expect(nativeModule).toContain('isEqualToString:@"production"');
    expect(nativeModule).not.toMatch(
      /embedded\.mobileprovision|NSISOLatin1StringEncoding|profileData|profilePath/,
    );
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
    expect(source).not.toContain('extensionContext?.open');
    expect(source).not.toMatch(/authToken|User-Api-Key|clientId|credential/i);
    expect(source).not.toContain('UIApplication.shared');
  });

  test('consumes and deletes bounded shared payload before authenticated routing', () => {
    const nativeModule = read('ios/DiscourseKeyboardShortcuts.m');
    const app = read('js/Discourse.js');
    expect(nativeModule).toContain('consumeShareIntent');
    expect(nativeModule).toContain('removeItemAtURL:file');
    expect(nativeModule).toContain('data.length > 12288');
    expect(nativeModule).toContain('age <= 300');
    expect(nativeModule).toContain('adjusternetwork.org');
    expect(app).toContain("event.url === 'adjusternetwork://share'");
    expect(app).toContain('async _consumeShareIntent()');
    expect(app).toContain('candidate => candidate.authToken');
    expect(app).not.toContain('if (params.sharedUrl)');
  });
});
