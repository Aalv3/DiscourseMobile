const {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  utimesSync,
  existsSync,
} = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const { spawnSync } = require('child_process');

const script = join(
  __dirname,
  '..',
  '..',
  'scripts',
  'native-build-storage.mjs',
);
const GiB = 1024 ** 3;

function invoke(root, args, environment = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AN_NATIVE_LOCAL_ROOT: root,
      AN_NATIVE_TEST_FREE_BYTES: String(100 * GiB),
      ...environment,
    },
  });
}

function begin(
  root,
  workflow = 'test-workflow',
  runId = 'run-1',
  environment = {},
) {
  return invoke(
    root,
    ['begin', `--workflow=${workflow}`, `--run-id=${runId}`],
    environment,
  );
}

describe('native build storage integration', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'an-native-storage-test-'));
  });

  test.each(['success', 'failed'])(
    '%s build removes workspace but preserves evidence',
    status => {
      expect(begin(root).status).toBe(0);
      const workspace = join(root, 'build-workspace', 'test-workflow', 'run-1');
      const evidence = join(root, 'evidence', 'test-workflow', 'run-1');
      writeFileSync(join(workspace, 'large-build-output'), 'disposable');
      writeFileSync(join(evidence, 'result.json'), '{}');
      const result = invoke(root, [
        'finish',
        '--workflow=test-workflow',
        '--run-id=run-1',
        `--status=${status}`,
      ]);
      expect(result.status).toBe(0);
      expect(existsSync(workspace)).toBe(false);
      expect(existsSync(join(evidence, 'result.json'))).toBe(true);
      expect(existsSync(join(evidence, 'accounting.json'))).toBe(true);
    },
  );

  test('protected archives, IPAs and dSYMs are never deleted', () => {
    const workspace = join(
      root,
      'build-workspace',
      'test-workflow',
      'abandoned',
    );
    mkdirSync(join(workspace, 'Release.xcarchive'), { recursive: true });
    writeFileSync(join(workspace, 'Release.ipa'), 'protected');
    mkdirSync(join(workspace, 'Release.dSYM'));
    const result = invoke(root, ['maintenance', '--delete']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('PROTECTED');
    expect(existsSync(workspace)).toBe(true);
  });

  test('regenerative DerivedData dSYMs are disposable', () => {
    const workspace = join(root, 'build-workspace', 'symbols', 'abandoned');
    mkdirSync(join(workspace, 'DerivedData', 'Build', 'Products', 'App.dSYM'), {
      recursive: true,
    });
    const result = invoke(root, ['maintenance', '--delete']);
    expect(result.status).toBe(0);
    expect(existsSync(workspace)).toBe(false);
  });

  test('retention preserves only the latest three ordinary runs', () => {
    const workflow = join(root, 'evidence', 'retention');
    for (let index = 1; index <= 5; index += 1) {
      const path = join(workflow, `run-${index}`);
      mkdirSync(path, { recursive: true });
      const date = new Date(Date.now() + index * 1000);
      utimesSync(path, date, date);
    }
    expect(invoke(root, ['maintenance', '--delete']).status).toBe(0);
    expect(existsSync(join(workflow, 'run-1'))).toBe(false);
    expect(existsSync(join(workflow, 'run-2'))).toBe(false);
    expect(existsSync(join(workflow, 'run-3'))).toBe(true);
  });

  test('age-based retention expires an old ordinary run', () => {
    const path = join(root, 'evidence', 'age', 'old-run');
    mkdirSync(path, { recursive: true });
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    utimesSync(path, old, old);
    invoke(root, ['maintenance', '--delete']);
    expect(existsSync(path)).toBe(false);
  });

  test('protected evidence is exempt from retention', () => {
    const path = join(root, 'evidence', 'release', 'signed-release');
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, '.protected'), 'owner-approved release artifact');
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    utimesSync(path, old, old);
    invoke(root, ['maintenance', '--delete']);
    expect(existsSync(path)).toBe(true);
  });

  test('release artifacts protect evidence even without a marker', () => {
    const path = join(root, 'evidence', 'release', 'artifact-run');
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'AdjusterNetwork.ipa'), 'protected');
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    utimesSync(path, old, old);
    invoke(root, ['maintenance', '--delete']);
    expect(existsSync(path)).toBe(true);
  });

  test('low disk emits a prominent warning', () => {
    const result = begin(root, 'warning', 'run-1', {
      AN_NATIVE_TEST_FREE_BYTES: String(40 * GiB),
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('WARNING');
  });

  test('critical disk refuses a native build without emergency override', () => {
    const result = begin(root, 'refusal', 'run-1', {
      AN_NATIVE_TEST_FREE_BYTES: String(20 * GiB),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refusing native build');
  });

  test('active run is protected from another build and maintenance', () => {
    expect(begin(root).status).toBe(0);
    expect(begin(root, 'test-workflow', 'run-2').status).toBe(1);
    const maintenance = invoke(root, ['maintenance', '--delete']);
    expect(maintenance.stdout).not.toContain('run-1');
    expect(
      existsSync(join(root, 'build-workspace', 'test-workflow', 'run-1')),
    ).toBe(true);
  });

  test('stale lock from a dead process is recovered after the grace period', () => {
    const workflow = join(root, 'build-workspace', 'stale');
    mkdirSync(workflow, { recursive: true });
    const lock = join(workflow, '.active.json');
    writeFileSync(lock, JSON.stringify({ pid: 99999999 }));
    const old = new Date(Date.now() - 20 * 60 * 1000);
    utimesSync(lock, old, old);
    const result = begin(root, 'stale', 'replacement');
    expect(result.status).toBe(0);
    expect(existsSync(join(workflow, 'replacement'))).toBe(true);
  });

  test('maintenance defaults to dry-run', () => {
    const path = join(root, 'build-workspace', 'dry-run', 'abandoned');
    mkdirSync(path, { recursive: true });
    const result = invoke(root, ['maintenance']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DRY-RUN');
    expect(result.stdout).toContain('mode: dry-run');
    expect(existsSync(path)).toBe(true);
  });
});
