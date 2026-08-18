#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const root = resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const command = args[0] || 'help';
const option = (name, fallback = null) =>
  args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ??
  fallback;
const dryRun =
  args.includes('--dry-run') || process.env.AN_DEVEX_DRY_RUN === '1';
const evidence = resolve(
  option('evidence', join(root, '.local', 'evidence', 'native-devex')),
);

const run = (program, commandArgs, env = {}) => {
  const printable = [program, ...commandArgs].join(' ');
  console.log(`RUN ${printable}`);
  if (dryRun) return;
  const result = spawnSync(program, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status || 1);
};

const git = (...commandArgs) =>
  execFileSync('git', commandArgs, { cwd: root, encoding: 'utf8' }).trim();

const systemPatterns = [
  /push/i,
  /auth/i,
  /credential/i,
  /keychain/i,
  /deeplink|deep-link/i,
  /entitlement/i,
  /privacy/i,
  /DiscourseKeyboardShortcuts|AppDelegate/,
];
const nativePatterns = [
  /^ios\//,
  /^android\//,
  /Podfile|Gemfile|yarn\.lock|package\.json/,
  /app\.config\.js|eas\.json/,
];

export function classifyPaths(paths) {
  if (paths.some(path => systemPatterns.some(pattern => pattern.test(path))))
    return 'system';
  if (paths.some(path => nativePatterns.some(pattern => pattern.test(path))))
    return 'native';
  return 'js';
}

function changedPaths() {
  const base = option('base', 'HEAD');
  const committed = git('diff', '--name-only', base, '--');
  const local = execFileSync('git', ['status', '--porcelain=v1', '-z'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
    .map(line => line.slice(3));
  return [...new Set([...committed.split('\n').filter(Boolean), ...local])];
}

function coreValidation() {
  run('corepack', ['yarn', 'format:check']);
  run('corepack', ['yarn', 'lint']);
  run('corepack', ['yarn', 'test:unit', '--runInBand']);
}

function validate(lane) {
  console.log(`LANE ${lane}`);
  coreValidation();
  run('corepack', ['yarn', 'verify:ota']);
  if (lane === 'js' || lane === 'ota') return;
  run('node', ['scripts/native-devex-native.mjs', '--configuration=Release']);
  if (lane === 'system') {
    console.log(
      'PHYSICAL_REQUIRED boundary audit + durable diagnostics + TestFlight artifact',
    );
  }
}

function stageOta() {
  if (!dryRun && git('status', '--porcelain'))
    throw new Error('OTA staging requires a clean tree');
  const sha = git('rev-parse', 'HEAD');
  run(
    'npx',
    [
      'eas-cli@latest',
      'update',
      '--branch',
      'staging',
      '--platform',
      'all',
      '--message',
      option('message', `Staging ${sha.slice(0, 12)}`),
      '--non-interactive',
    ],
    { AN_OTA_CHANNEL: 'staging', AN_OTA_GIT_SHA: sha },
  );
}

function promoteOta() {
  const group = option('group');
  if (!group || !/^[0-9a-f-]{36}$/.test(group))
    throw new Error('--group=<certified EAS group UUID> is required');
  run('npx', [
    'eas-cli@latest',
    'update:republish',
    '--group',
    group,
    '--destination-channel',
    'production',
    '--platform',
    'all',
    '--message',
    option('message', 'Promote physically certified staging OTA'),
    '--non-interactive',
  ]);
}

function writeSummary(lane) {
  mkdirSync(evidence, { recursive: true });
  const payload = {
    timestamp: new Date().toISOString(),
    lane,
    sha: git('rev-parse', 'HEAD'),
    clean: git('status', '--porcelain') === '',
    dryRun,
  };
  writeFileSync(
    join(evidence, 'last-run.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  console.log(`PASS evidence=${join(evidence, 'last-run.json')}`);
}

try {
  if (command === 'classify') {
    const paths = changedPaths();
    console.log(JSON.stringify({ lane: classifyPaths(paths), paths }, null, 2));
  } else if (command === 'validate') {
    const lane = option('lane', 'js');
    if (!['js', 'ota', 'native', 'system'].includes(lane))
      throw new Error('invalid lane');
    validate(lane);
    writeSummary(lane);
  } else if (command === 'ota-stage') {
    stageOta();
  } else if (command === 'ota-promote') {
    promoteOta();
  } else {
    console.log(
      'native-devex: classify | validate --lane=js|ota|native|system | ota-stage | ota-promote',
    );
  }
} catch (error) {
  console.error(`native-devex: ${error.message}`);
  process.exitCode = 1;
}
