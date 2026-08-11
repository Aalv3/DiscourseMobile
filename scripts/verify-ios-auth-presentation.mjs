import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../vendor/react-native-safari-web-auth/ios/SafariWebAuth.swift', import.meta.url),
  'utf8',
);

const assertions = [
  ['uses a connected UIWindowScene', source.includes('UIApplication.shared.connectedScenes')],
  ['prefers the scene key window', source.includes('scene.windows.first(where: { $0.isKeyWindow })')],
  ['rejects when no presentation window exists', source.includes('auth_presentation_unavailable')],
  ['checks the Boolean start result', source.includes('guard session.start() else')],
  ['rejects a failed start', source.includes('auth_start_failed')],
  ['does not create an unattached anchor', !source.includes('ASPresentationAnchor()')],
];

for (const [label, passed] of assertions) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
}
if (assertions.some(([, passed]) => !passed)) process.exit(1);
