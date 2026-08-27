import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const findings = [];
const check = (area, state, detail) => findings.push({ area, state, detail });
const archiveFlag = process.argv.indexOf('--archive');
const archivePath = archiveFlag >= 0 ? process.argv[archiveFlag + 1] : null;

const androidGradle = read('android/app/build.gradle');
const androidManifest = read('android/app/src/main/AndroidManifest.xml');
const iosProject = read('ios/Discourse.xcodeproj/project.pbxproj');
const iosInfo = read('ios/Discourse/Info.plist');
const iosEntitlements = read('ios/Discourse/Discourse.entitlements');
const iosDevelopmentEntitlements = read(
  'ios/Discourse/Discourse.development.entitlements',
);
const shareEntitlements = read(
  'ios/ShareExtension/ShareExtension.entitlements',
);
const shareController = read('ios/ShareExtension/ShareViewController.swift');
const iosNativeModule = read('ios/DiscourseKeyboardShortcuts.m');
const productConfig = read('js/adjusterNetworkConfig.js');
const expoConfig = read('app.config.js');
const expoPlist = read('ios/Discourse/Supporting/Expo.plist');
const packageManifest = read('package.json');
const siteManager = read('js/site_manager.js');
const productScreens = read('js/product/ProductScreens.js');
const keyPairPatch = read(
  '.yarn/patches/react-native-key-pair-https-9b14573360.patch',
);

check(
  'privacy controls',
  androidManifest.includes('android:allowBackup="false"') &&
    androidManifest.includes('android:usesCleartextTraffic="false"') &&
    productConfig.includes('push: false')
    ? 'PASS'
    : 'FAIL',
  'Android backup/cleartext must be disabled and push must remain off',
);
check(
  'Android application identity',
  androidGradle.includes('applicationId "org.adjusternetwork.app"')
    ? 'PASS'
    : 'FAIL',
  'Owner-approved application ID must be org.adjusternetwork.app',
);
check(
  'Android verified links',
  androidManifest.includes('android:autoVerify="true"') &&
    androidManifest.includes('android:host="adjusternetwork.org"') &&
    ['/t/', '/c/', '/u/'].every(path =>
      androidManifest.includes(`android:pathPrefix="${path}"`),
    )
    ? 'PASS'
    : 'FAIL',
  'Owner-approved adjusternetwork.org topic/category/user paths must be declared',
);
check(
  'Android signing',
  'OUT_OF_BAND_SIGNING',
  'Owner custody is approved; release keystore and credentials must be supplied out of band at the signed-build wave',
);
check(
  'iOS application identity',
  iosProject.includes('PRODUCT_BUNDLE_IDENTIFIER = org.adjusternetwork.app;') &&
    iosProject.includes(
      'PRODUCT_BUNDLE_IDENTIFIER = org.adjusternetwork.app.ShareExtension;',
    )
    ? 'PASS'
    : 'FAIL',
  'Owner-approved app and Share Extension bundle IDs must be configured',
);
check(
  'iOS callback scheme',
  iosInfo.includes('<string>adjusternetwork</string>') ? 'PASS' : 'FAIL',
  'Owner-approved callback scheme must be configured',
);
check(
  'iOS associated domains',
  iosEntitlements.includes('applinks:adjusternetwork.org') &&
    !iosEntitlements.includes('discourse.org')
    ? 'PASS'
    : 'FAIL',
  'Only the owner-authorized Adjuster Network association domain may remain',
);
check(
  'A3-owned push disposition',
  !packageManifest.includes('@react-native-firebase') &&
    !androidGradle.includes('google-services') &&
    productConfig.includes('push: false') &&
    productConfig.includes('pushDelivery: true') &&
    iosEntitlements.includes('aps-environment') &&
    !iosInfo.includes('<string>remote-notification</string>')
    ? 'PASS'
    : 'FAIL',
  'Direct APNs registration must remain separate from the disabled legacy relay, Firebase and analytics',
);
check(
  'iOS APNs build-channel separation',
  iosProject.includes('AN_PUSH_ENVIRONMENT = staging;') &&
    iosProject.includes('AN_PUSH_ENVIRONMENT = production;') &&
    iosProject.includes(
      'CODE_SIGN_ENTITLEMENTS = Discourse/Discourse.development.entitlements;',
    ) &&
    iosProject.includes(
      'CODE_SIGN_ENTITLEMENTS = Discourse/Discourse.entitlements;',
    ) &&
    iosDevelopmentEntitlements.includes('<string>development</string>') &&
    iosEntitlements.includes('<string>production</string>') &&
    !iosDevelopmentEntitlements.includes('$(') &&
    !iosEntitlements.includes('$(') &&
    iosInfo.includes('$(AN_PUSH_ENVIRONMENT)')
    ? 'PASS'
    : 'FAIL',
  'Debug must pair APNs sandbox with staging and Release must pair production APNs with production backend registration',
);
check(
  'iOS runtime signing boundary',
  !iosNativeModule.includes('SecTask') &&
    !iosNativeModule.includes('embedded.mobileprovision') &&
    !iosNativeModule.includes('NSISOLatin1StringEncoding')
    ? 'PASS'
    : 'FAIL',
  'Runtime must delegate APNs entitlement authority to iOS and never inspect signatures or provisioning files',
);
check(
  'permanent staging OTA architecture',
  expoConfig.includes("useEmbeddedUpdate: otaChannel !== 'staging'") &&
    iosProject.includes('staging) embedded=false') &&
    iosProject.includes('production) embedded=true') &&
    expoPlist.includes('EXUpdatesHasEmbeddedUpdate')
    ? 'PASS'
    : 'FAIL',
  'Staging must be remote-update-first while production retains its embedded recovery update',
);
check(
  'iOS Share Extension App Group boundary',
  iosEntitlements.includes('group.org.adjusternetwork.app') &&
    shareEntitlements.includes('group.org.adjusternetwork.app') &&
    shareController.includes('an.share-intent.v1') &&
    shareController.includes('.completeFileProtection') &&
    !shareController.includes('UIApplication.shared')
    ? 'PASS'
    : 'FAIL',
  'The extension must hand off only a bounded protected intent through the shared App Group',
);
check(
  'release version',
  androidGradle.includes('versionCode 1') &&
    iosProject.includes('MARKETING_VERSION = 1.0;') &&
    iosProject.includes('CURRENT_PROJECT_VERSION = 8;')
    ? 'PASS'
    : 'FAIL',
  'Owner-approved iOS release is version 1.0 build 8',
);
check(
  'iOS ATS',
  iosInfo.includes('<key>NSAllowsArbitraryLoads</key>\n\t<false/>')
    ? 'PASS'
    : 'FAIL',
  'Arbitrary loads must remain disabled',
);
check(
  'iOS authentication key lifecycle',
  packageManifest.includes('react-native-key-pair-https-9b14573360.patch') &&
    keyPairPatch.includes('SecItemDelete((CFDictionaryRef)oldPrivateKey)') &&
    siteManager.includes('keys = await credentialStore.readRSAKeys()') &&
    siteManager.includes('await credentialStore.storeRSAKeys(keys)')
    ? 'PASS'
    : 'FAIL',
  'Temporary RSA staging keys must be removed and Keychain failures must reject instead of leaving authentication pending',
);
check(
  'iOS canonical welcome branding',
  productScreens.includes('height: 103, aspectRatio: 1183 / 845') &&
    productScreens.includes("overflow: 'hidden'") &&
    productScreens.includes('accessibilityLabel="Adjuster Network"')
    ? 'PASS'
    : 'FAIL',
  'The canonical Retina logo must remain bounded, aspect-correct and accessible',
);
check(
  'iOS runtime evidence',
  process.platform === 'darwin' ? 'READY_TO_EXECUTE' : 'EXTERNAL_BLOCKER',
  'Requires an accessible Mac with supported Xcode and iPhone/iPad simulator runtimes; simulator evidence does not require signing',
);

if (archivePath) {
  const app = `${archivePath}/Products/Applications/AdjusterNetwork.app`;
  const shareExtension = `${app}/PlugIns/ShareExtension.appex`;
  const embeddedHermes = `${app}/Frameworks/hermes.framework/hermes`;
  const archivedDwarf = `${archivePath}/dSYMs/hermes.framework.dSYM/Contents/Resources/DWARF/hermes`;
  const command = (executable, args) =>
    execFileSync(executable, args, { encoding: 'utf8' });
  const plistValue = (path, key) =>
    command('plutil', ['-extract', key, 'raw', '-o', '-', path]).trim();
  const signedEntitlements = path =>
    command('codesign', ['-d', '--entitlements', ':-', path]);
  const profile = path =>
    command('security', [
      'cms',
      '-D',
      '-i',
      `${path}/embedded.mobileprovision`,
    ]);
  const hasStringValue = (plist, key, value) =>
    new RegExp(`<key>${key}</key>\\s*<string>${value}</string>`).test(plist);
  const hasTrueValue = (plist, key) =>
    new RegExp(`<key>${key}</key>\\s*<true\\s*/>`).test(plist);
  const uuid = path =>
    execFileSync('dwarfdump', ['--uuid', path], { encoding: 'utf8' }).match(
      /UUID: ([0-9A-F-]+)/,
    )?.[1];
  let archiveSymbolsValid = false;
  try {
    const sectionSizes = execFileSync(
      'xcrun',
      ['llvm-dwarfdump', '--show-section-sizes', archivedDwarf],
      { encoding: 'utf8' },
    );
    archiveSymbolsValid =
      fs.statSync(archivedDwarf).size > 0 &&
      uuid(embeddedHermes) === uuid(archivedDwarf) &&
      /^__debug_info\s+[1-9][0-9]*/m.test(sectionSizes);
  } catch {
    archiveSymbolsValid = false;
  }
  check(
    'archived Hermes symbols',
    archiveSymbolsValid ? 'PASS' : 'FAIL',
    'Final xcarchive must contain a non-empty Hermes dSYM with real DWARF and the embedded framework UUID',
  );

  let archiveReleaseValid = false;
  let archiveProfilesValid = false;
  try {
    const appEntitlements = signedEntitlements(app);
    const extensionEntitlements = signedEntitlements(shareExtension);
    const appProfile = profile(app);
    const extensionProfile = profile(shareExtension);
    archiveReleaseValid =
      plistValue(`${app}/Info.plist`, 'CFBundleIdentifier') ===
        'org.adjusternetwork.app' &&
      plistValue(`${app}/Info.plist`, 'ANPushEnvironment') === 'production' &&
      hasStringValue(appEntitlements, 'aps-environment', 'production') &&
      plistValue(`${app}/Expo.plist`, 'EXUpdatesHasEmbeddedUpdate') ===
        'true' &&
      !hasTrueValue(appEntitlements, 'get-task-allow') &&
      appEntitlements.includes('applinks:adjusternetwork.org') &&
      appEntitlements.includes('group.org.adjusternetwork.app') &&
      extensionEntitlements.includes('group.org.adjusternetwork.app') &&
      productConfig.includes(
        'backendOrigin: canonicalOriginForChannel(updateChannel)',
      );
    archiveProfilesValid =
      hasStringValue(appProfile, 'Name', 'Adjuster Network App Store') &&
      hasStringValue(
        extensionProfile,
        'Name',
        'Adjuster Network Share Extension App Store',
      ) &&
      hasStringValue(appProfile, 'aps-environment', 'production') &&
      !hasTrueValue(appProfile, 'get-task-allow') &&
      !hasTrueValue(extensionProfile, 'get-task-allow');
  } catch {
    archiveReleaseValid = false;
    archiveProfilesValid = false;
  }
  check(
    'archived production APNs and runtime boundary',
    archiveReleaseValid ? 'PASS' : 'FAIL',
    'Final archive must be the production app identity with production runtime, production signed APNs entitlement, distribution restrictions, App Group and Associated Domain',
  );
  check(
    'archived App Store provisioning',
    archiveProfilesValid ? 'PASS' : 'FAIL',
    'Main app and Share Extension must use the approved App Store profiles without development task access',
  );
}

const failed = findings.filter(item => item.state === 'FAIL');
const pending = findings.filter(item => item.state === 'OWNER_INPUT');
console.log(
  JSON.stringify(
    { findings, failed: failed.length, ownerInputs: pending.length },
    null,
    2,
  ),
);
if (failed.length) process.exitCode = 1;
