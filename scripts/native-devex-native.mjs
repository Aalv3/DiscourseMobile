#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const workflow = 'native-devex-iphoneos';
const begin = spawnSync(
  process.execPath,
  [
    'scripts/native-build-storage.mjs',
    'begin',
    `--workflow=${workflow}`,
    '--shell',
  ],
  { encoding: 'utf8' },
);
if (begin.status !== 0) {
  process.stderr.write(begin.stderr);
  process.exit(begin.status || 1);
}
const environment = { ...process.env };
for (const line of begin.stdout.trim().split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)='(.*)'$/);
  if (match) environment[match[1]] = match[2].replaceAll("'\\''", "'");
}
let status = 'failed';
try {
  const result = spawnSync(
    'xcodebuild',
    [
      '-workspace',
      'ios/Discourse.xcworkspace',
      '-scheme',
      'Discourse',
      '-configuration',
      'Release',
      '-sdk',
      'iphoneos',
      '-destination',
      'generic/platform=iOS',
      '-derivedDataPath',
      `${environment.AN_NATIVE_BUILD_WORKSPACE}/DerivedData`,
      'CODE_SIGNING_ALLOWED=NO',
      'build',
    ],
    { stdio: 'inherit', env: environment },
  );
  if (result.status !== 0) process.exitCode = result.status || 1;
  else status = 'success';
} finally {
  spawnSync(
    process.execPath,
    [
      'scripts/native-build-storage.mjs',
      'finish',
      `--workflow=${workflow}`,
      `--run-id=${environment.AN_NATIVE_RUN_ID}`,
      `--status=${status}`,
    ],
    { stdio: 'inherit', env: environment },
  );
}
