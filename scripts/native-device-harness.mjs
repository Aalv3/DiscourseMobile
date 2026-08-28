#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { selectPhysicalIPhone } from './native-device-selection.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const command = args[0] || 'status';
const option = name =>
  args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = resolve(
  option('output') || join(root, '.local', 'evidence', 'physical-device'),
);
mkdirSync(output, { recursive: true });
chmodSync(output, 0o700);
const deviceJson = join(output, 'device-private.json');

function execute(program, commandArgs, json = null) {
  const argsWithOutput = json
    ? [...commandArgs, '--json-output', json]
    : commandArgs;
  const result = spawnSync(program, argsWithOutput, {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || `${program} failed`);
  return result.stdout;
}

function device() {
  execute('xcrun', ['devicectl', 'list', 'devices'], deviceJson);
  const devices = JSON.parse(readFileSync(deviceJson, 'utf8')).result.devices;
  return selectPhysicalIPhone(devices, option('device'));
}

function status() {
  const selected = device();
  console.log(
    JSON.stringify(
      {
        kind: 'physical-iPhone',
        model: selected.hardwareProperties?.marketingName || 'iPhone',
        os: selected.deviceProperties?.osVersionNumber || 'unknown',
        connected: true,
        paired: true,
      },
      null,
      2,
    ),
  );
}

function install() {
  const app = option('app');
  if (!app || !app.endsWith('.app'))
    throw new Error('--app=<signed .app> is required');
  execute(
    'xcrun',
    [
      'devicectl',
      'device',
      'install',
      'app',
      '--device',
      device().identifier,
      app,
    ],
    join(output, 'install.json'),
  );
  console.log('PASS signed app installed on founder/internal physical iPhone');
}

function launch() {
  execute(
    'xcrun',
    [
      'devicectl',
      'device',
      'process',
      'launch',
      '--device',
      device().identifier,
      '--terminate-existing',
      'org.adjusternetwork.app',
    ],
    join(output, 'launch.json'),
  );
  console.log('PASS Adjuster Network launched on physical iPhone');
}

function copyFromDevice(source, destination) {
  execute('xcrun', [
    'devicectl',
    'device',
    'copy',
    'from',
    '--device',
    device().identifier,
    '--domain-type',
    'appDataContainer',
    '--domain-identifier',
    'org.adjusternetwork.app',
    '--source',
    source,
    '--destination',
    destination,
  ]);
  chmodSync(destination, 0o600);
}

function copyFromAppGroup(source, destination) {
  execute('xcrun', [
    'devicectl',
    'device',
    'copy',
    'from',
    '--device',
    device().identifier,
    '--domain-type',
    'appGroupDataContainer',
    '--domain-identifier',
    'group.org.adjusternetwork.app',
    '--source',
    source,
    '--destination',
    destination,
  ]);
  chmodSync(destination, 0o600);
}

function otaStatus() {
  const database = join(output, 'expo-v11.db');
  copyFromDevice(
    'Library/Application Support/.expo-internal/expo-v11.db',
    database,
  );
  const rows = execFileSync(
    'sqlite3',
    [
      '-json',
      database,
      'select lower(hex(id)) as updateId,runtime_version as runtimeVersion,status,successful_launch_count as successfulLaunches,failed_launch_count as failedLaunches from updates order by last_accessed desc limit 1;',
    ],
    { encoding: 'utf8' },
  );
  console.log(rows.trim() || '[]');
}

function pushDiagnostics() {
  const path = join(output, 'push-registration.ndjson');
  copyFromDevice(
    'Library/Application Support/AdjusterNetworkDiagnostics/push-registration.ndjson',
    path,
  );
  const allowed = new Set([
    'timestamp',
    'stage',
    'category',
    'http',
    'outcome',
  ]);
  for (const line of readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)) {
    const input = JSON.parse(line);
    console.log(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(input).filter(([key]) => allowed.has(key)),
        ),
      ),
    );
  }
}

function shareDiagnostics() {
  const path = join(output, 'share-extension.ndjson');
  copyFromAppGroup('share-extension.ndjson', path);
  const allowed = new Set([
    'timestamp',
    'stage',
    'category',
    'outcome',
    'error_domain',
    'error_code',
  ]);
  for (const line of readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)) {
    const input = JSON.parse(line);
    console.log(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(input).filter(([key]) => allowed.has(key)),
        ),
      ),
    );
  }
}

function notificationDiagnostics() {
  const key = '@AdjusterNetwork.notificationDiagnostics.v1';
  const directory =
    'Library/Application Support/org.adjusternetwork.app/RCTAsyncLocalStorage_V1';
  const manifestPath = join(output, 'async-storage-manifest.json');
  copyFromDevice(`${directory}/manifest.json`, manifestPath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let stored = manifest[key];
  if (stored === null) {
    const hash = createHash('md5').update(key).digest('hex');
    const valuePath = join(output, 'notification-diagnostics.json');
    copyFromDevice(`${directory}/${hash}`, valuePath);
    stored = readFileSync(valuePath, 'utf8');
  }
  const entries = stored ? JSON.parse(stored) : [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    console.log(JSON.stringify(entry));
  }
}

function pushStatusDiagnostics() {
  const key = '@AdjusterNetwork.pushStatusDiagnostics.v1';
  const directory =
    'Library/Application Support/org.adjusternetwork.app/RCTAsyncLocalStorage_V1';
  const manifestPath = join(output, 'async-storage-manifest.json');
  copyFromDevice(`${directory}/manifest.json`, manifestPath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let stored = manifest[key];
  if (stored === null) {
    const hash = createHash('md5').update(key).digest('hex');
    const valuePath = join(output, 'push-status-diagnostics.json');
    copyFromDevice(`${directory}/${hash}`, valuePath);
    stored = readFileSync(valuePath, 'utf8');
  }
  const entries = stored ? JSON.parse(stored) : [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    console.log(JSON.stringify(entry));
  }
}

function profileDiagnostics() {
  const key = '@AdjusterNetwork.profileDiagnostics.v1';
  const directory =
    'Library/Application Support/org.adjusternetwork.app/RCTAsyncLocalStorage_V1';
  const manifestPath = join(output, 'async-storage-manifest.json');
  copyFromDevice(`${directory}/manifest.json`, manifestPath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let stored = manifest[key];
  if (stored === null) {
    const hash = createHash('md5').update(key).digest('hex');
    const valuePath = join(output, 'profile-diagnostics.json');
    copyFromDevice(`${directory}/${hash}`, valuePath);
    stored = readFileSync(valuePath, 'utf8');
  }
  const entries = stored ? JSON.parse(stored) : [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    console.log(JSON.stringify(entry));
  }
}

try {
  if (command === 'status') status();
  else if (command === 'install') install();
  else if (command === 'launch') launch();
  else if (command === 'ota-status') otaStatus();
  else if (command === 'push-diagnostics') pushDiagnostics();
  else if (command === 'share-diagnostics') shareDiagnostics();
  else if (command === 'notification-diagnostics') notificationDiagnostics();
  else if (command === 'push-status-diagnostics') pushStatusDiagnostics();
  else if (command === 'profile-diagnostics') profileDiagnostics();
  else
    throw new Error(
      'status | install --app=... | launch | ota-status | push-diagnostics | push-status-diagnostics | profile-diagnostics | share-diagnostics | notification-diagnostics',
    );
} catch (error) {
  console.error(`native-device-harness: ${error.message}`);
  process.exitCode = 1;
}
