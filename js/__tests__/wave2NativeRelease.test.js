/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';
import plist from 'plist';

const root = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

describe('Wave 2 native release boundaries', () => {
  test('launch screen uses canonical Adjuster Network artwork', () => {
    const launch = read('ios/Discourse/Base.lproj/LaunchScreen.xib');
    expect(launch).toContain('image="adjuster-network-logo.png"');
    expect(launch).not.toContain('image="nav-icon-gray.png"');
  });

  test('Release embeds a generated matching Hermes dSYM', () => {
    const project = read('ios/Discourse.xcodeproj/project.pbxproj');
    expect(project).toContain('Generate Hermes dSYM');
    expect(project).toContain('xcrun dsymutil');
    expect(
      project.indexOf(
        '76F0B67DB1686AF6FA39E8E4 /* [CP] Embed Pods Frameworks */',
      ),
    ).toBeLessThan(
      project.lastIndexOf(
        'A30A0A122E4B000100000001 /* Generate Hermes dSYM */',
      ),
    );
  });

  test('only the target-owned privacy manifest remains canonical', () => {
    expect(fs.existsSync(path.join(root, 'ios/PrivacyInfo.xcprivacy'))).toBe(
      false,
    );
    const manifest = read('ios/Discourse/PrivacyInfo.xcprivacy');
    expect(manifest).toContain('NSPrivacyAccessedAPICategoryUserDefaults');
    expect(manifest).toContain('NSPrivacyCollectedDataTypeOtherUserContent');
    expect(manifest).toContain('NSPrivacyCollectedDataTypeSearchHistory');
    expect(manifest).toContain('NSPrivacyCollectedDataTypeDeviceID');
    const collectedDataTypes =
      plist.parse(manifest).NSPrivacyCollectedDataTypes;
    for (const dataType of [
      'NSPrivacyCollectedDataTypeEmailAddress',
      'NSPrivacyCollectedDataTypeCoarseLocation',
    ]) {
      expect(collectedDataTypes).toContainEqual({
        NSPrivacyCollectedDataType: dataType,
        NSPrivacyCollectedDataTypeLinked: true,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: [
          'NSPrivacyCollectedDataTypePurposeAppFunctionality',
        ],
      });
    }
    expect(manifest).not.toContain('NSPrivacyAccessedAPICategoryDiskSpace');
    expect(manifest).not.toContain('NSPrivacyAccessedAPICategoryFileTimestamp');
  });
});
