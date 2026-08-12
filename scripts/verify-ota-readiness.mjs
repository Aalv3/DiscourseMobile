import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const config = require(resolve(root, 'app.config.js'));
const ios = readFileSync(
  resolve(root, 'ios/Discourse/Supporting/Expo.plist'),
  'utf8',
);
const android = readFileSync(
  resolve(root, 'android/app/src/main/AndroidManifest.xml'),
  'utf8',
);
const androidStrings = readFileSync(
  resolve(root, 'android/app/src/main/res/values/strings.xml'),
  'utf8',
);
const certificate = readFileSync(
  resolve(root, config.updates.codeSigningCertificate),
  'utf8',
)
  .replace(/\r\n/g, '\n')
  .trim();
const runtime = config.runtimeVersion;

const checks = [
  ['explicit runtime boundary', /^an-ios-android-\d+\.\d+\.\d+-native-\d+$/.test(runtime)],
  ['EAS update URL', /^https:\/\/u\.expo\.dev\/[0-9a-f-]{36}$/.test(config.updates.url)],
  ['embedded recovery bundle', config.updates.useEmbeddedUpdate === true],
  ['anti-bricking enabled', config.updates.disableAntiBrickingMeasures === false],
  ['non-blocking launch', config.updates.fallbackToCacheTimeout === 0],
  ['iOS runtime matches', ios.includes(`<string>${runtime}</string>`)],
  ['Android runtime matches', androidStrings.includes(`>${runtime}</string>`) ],
  ['iOS certificate embedded', ios.includes(certificate)],
  [
    'Android certificate embedded',
    certificate
      .split(/\r?\n/)
      .every(line => android.includes(line)),
  ],
  ['iOS anti-bricking enabled', ios.includes('<key>EXUpdatesDisableAntiBrickingMeasures</key>\n    <false/>')],
  ['Android anti-bricking enabled', android.includes('DISABLE_ANTI_BRICKING_MEASURES" android:value="false"')],
  ['staging channel configured', readFileSync(resolve(root, 'eas.json'), 'utf8').includes('"channel": "staging"')],
  ['production channel configured', readFileSync(resolve(root, 'eas.json'), 'utf8').includes('"channel": "production"')],
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
}
console.log(
  `Certificate SHA-256: ${createHash('sha256').update(certificate).digest('hex')}`,
);

if (failures.length > 0) {
  process.exitCode = 1;
}
