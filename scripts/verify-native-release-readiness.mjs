import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const findings = [];
const check = (area, state, detail) => findings.push({ area, state, detail });

const androidGradle = read('android/app/build.gradle');
const androidManifest = read('android/app/src/main/AndroidManifest.xml');
const iosProject = read('ios/Discourse.xcodeproj/project.pbxproj');
const iosInfo = read('ios/Discourse/Info.plist');
const iosEntitlements = read('ios/Discourse/Discourse.entitlements');
const productConfig = read('js/adjusterNetworkConfig.js');
const packageManifest = read('package.json');

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
  androidGradle.includes('applicationId "org.adjusternetwork.app"') ? 'PASS' : 'FAIL',
  'Owner-approved application ID must be org.adjusternetwork.app',
);
check(
  'Android verified links',
  androidManifest.includes('android:autoVerify="true"') &&
    androidManifest.includes('android:host="adjusternetwork.org"') &&
    ['/t/', '/c/', '/u/'].every(path => androidManifest.includes(`android:pathPrefix="${path}"`))
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
    iosProject.includes('PRODUCT_BUNDLE_IDENTIFIER = org.adjusternetwork.app.ShareExtension;')
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
  'Firebase founding-beta disposition',
  !packageManifest.includes('@react-native-firebase') &&
    !androidGradle.includes('google-services') &&
    !iosEntitlements.includes('aps-environment') &&
    !iosInfo.includes('<string>remote-notification</string>')
    ? 'PASS'
    : 'FAIL',
  'Firebase and push entitlements must be absent while push, analytics and crash reporting remain off',
);
check(
  'release version',
  androidGradle.includes('versionCode 1') &&
    iosProject.includes('MARKETING_VERSION = 1.0.0;') &&
    iosProject.includes('CURRENT_PROJECT_VERSION = 1;')
    ? 'PASS'
    : 'FAIL',
  'Owner-approved initial release is version 1.0.0 build 1',
);
check(
  'iOS ATS',
  iosInfo.includes('<key>NSAllowsArbitraryLoads</key>\n\t<false/>') ? 'PASS' : 'FAIL',
  'Arbitrary loads must remain disabled',
);
check(
  'iOS runtime evidence',
  process.platform === 'darwin' ? 'READY_TO_EXECUTE' : 'EXTERNAL_BLOCKER',
  'Requires an accessible Mac with supported Xcode and iPhone/iPad simulator runtimes; simulator evidence does not require signing',
);

const failed = findings.filter(item => item.state === 'FAIL');
const pending = findings.filter(item => item.state === 'OWNER_INPUT');
console.log(JSON.stringify({ findings, failed: failed.length, ownerInputs: pending.length }, null, 2));
if (failed.length) process.exitCode = 1;
