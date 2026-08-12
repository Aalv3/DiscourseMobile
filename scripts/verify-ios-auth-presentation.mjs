import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../vendor/react-native-safari-web-auth/ios/SafariWebAuth.mm', import.meta.url),
  'utf8',
);
const podspec = fs.readFileSync(
  new URL(
    '../vendor/react-native-safari-web-auth/react-native-safari-web-auth.podspec',
    import.meta.url,
  ),
  'utf8',
);

const assertions = [
  ['uses a connected UIWindowScene', source.includes('UIApplication.sharedApplication.connectedScenes')],
  ['prefers the scene key window', source.includes('window.isKeyWindow')],
  ['rejects when no presentation window exists', source.includes('auth_presentation_unavailable')],
  ['checks the Boolean start result', source.includes('if (![session start])')],
  ['rejects a failed start', source.includes('auth_start_failed')],
  ['does not create an unattached anchor', !source.includes('[[UIWindow alloc] init]')],
  ['settles the native promise only once', source.includes('if (settled)') && source.includes('settled = YES')],
  ['does not compile Swift in the auth pod', !fs.existsSync(new URL('../vendor/react-native-safari-web-auth/ios/SafariWebAuth.swift', import.meta.url))],
  [
    'links AuthenticationServices explicitly',
    podspec.includes('s.frameworks = "AuthenticationServices", "UIKit"'),
  ],
];

for (const [label, passed] of assertions) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
}
if (assertions.some(([, passed]) => !passed)) process.exit(1);
