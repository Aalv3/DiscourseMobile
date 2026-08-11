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
  androidGradle.includes('applicationId "com.discourse"') ? 'OWNER_INPUT' : 'CONFIGURED',
  'Replace the upstream application ID only after the owner allocates the controlled identifier',
);
check(
  'Android verified links',
  androidManifest.includes('android:autoVerify="true"') ? 'CONFIGURED' : 'OWNER_INPUT',
  'Requires the owner-approved application ID, callback scheme, domain association and certificate fingerprint',
);
check(
  'Android signing',
  'OWNER_INPUT',
  'Release keystore and credentials must be supplied out of band; debug credentials are not release evidence',
);
check(
  'iOS application identity',
  iosProject.includes('PRODUCT_BUNDLE_IDENTIFIER = org.discourse.DiscourseApp;')
    ? 'OWNER_INPUT'
    : 'CONFIGURED',
  'Replace upstream bundle IDs and signing team only after owner allocation',
);
check(
  'iOS callback scheme',
  iosInfo.includes('<string>discourse</string>') ? 'OWNER_INPUT' : 'CONFIGURED',
  'Shared upstream scheme is development compatibility only',
);
check(
  'iOS associated domains',
  iosEntitlements.includes('meta.discourse.org') ? 'OWNER_INPUT' : 'CONFIGURED',
  'Remove upstream domains and add only owner-authorized Adjuster Network associations',
);
check(
  'iOS ATS',
  iosInfo.includes('<key>NSAllowsArbitraryLoads</key>\n\t<false/>') ? 'PASS' : 'FAIL',
  'Arbitrary loads must remain disabled',
);

const failed = findings.filter(item => item.state === 'FAIL');
const pending = findings.filter(item => item.state === 'OWNER_INPUT');
console.log(JSON.stringify({ findings, failed: failed.length, ownerInputs: pending.length }, null, 2));
if (failed.length) process.exitCode = 1;
