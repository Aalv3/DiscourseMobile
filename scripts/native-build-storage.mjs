#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  constants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statfsSync,
  statSync,
  writeFileSync,
  closeSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const GiB = 1024 ** 3;
const warningBytes = Number(
  process.env.AN_NATIVE_DISK_WARNING_BYTES || 50 * GiB,
);
const refusalBytes = Number(
  process.env.AN_NATIVE_DISK_REFUSAL_BYTES || 25 * GiB,
);
const maxRuns = Number(process.env.AN_NATIVE_EVIDENCE_MAX_RUNS || 3);
const maxAgeDays = Number(process.env.AN_NATIVE_EVIDENCE_MAX_AGE_DAYS || 10);
const staleLockMinutes = Number(process.env.AN_NATIVE_STALE_LOCK_MINUTES || 15);
const protectedSuffixes = ['.xcarchive', '.ipa'];

const args = process.argv.slice(2);
const command = args[0] || 'maintenance';
const option = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const value = args.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};
const hasFlag = name => args.includes(`--${name}`);

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const localRoot = resolve(
  process.env.AN_NATIVE_LOCAL_ROOT || join(repoRoot, '.local'),
);
const evidenceRoot = join(localRoot, 'evidence');
const workspaceRoot = join(localRoot, 'build-workspace');

function byteSize(path) {
  if (!existsSync(path)) return 0;
  const output = execFileSync('/usr/bin/du', ['-sk', path], {
    encoding: 'utf8',
  });
  return Number(output.trim().split(/\s+/)[0] || 0) * 1024;
}

function freeBytes() {
  if (process.env.AN_NATIVE_TEST_FREE_BYTES) {
    return Number(process.env.AN_NATIVE_TEST_FREE_BYTES);
  }
  const result = statfsSync(repoRoot);
  return Number(result.bavail) * Number(result.bsize);
}

function human(bytes) {
  return `${(bytes / GiB).toFixed(2)} GiB`;
}

function safeWorkflow(value) {
  if (!value || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    throw new Error('workflow must use lowercase letters, digits, and hyphens');
  }
  return value;
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function activeLock(lockPath) {
  if (!existsSync(lockPath)) return null;
  const lock = readJson(lockPath);
  const ageMs = Date.now() - statSync(lockPath).mtimeMs;
  if (lock && pidAlive(lock.pid)) return lock;
  if (ageMs < staleLockMinutes * 60 * 1000) {
    return { ...(lock || {}), uncertain: true };
  }
  rmSync(lockPath, { force: true });
  return null;
}

function containsProtectedArtifact(path) {
  if (!existsSync(path)) return false;
  const stack = [path];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (protectedSuffixes.some(suffix => entry.name.endsWith(suffix)))
        return true;
      if (
        entry.name.endsWith('.dSYM') &&
        !join(current, entry.name).includes('/DerivedData/Build/Products/')
      )
        return true;
      if (entry.isDirectory()) stack.push(join(current, entry.name));
    }
  }
  return false;
}

function removeDisposable(path) {
  const resolved = resolve(path);
  if (!resolved.startsWith(`${workspaceRoot}/`)) {
    throw new Error(`refusing cleanup outside build workspace: ${resolved}`);
  }
  if (containsProtectedArtifact(resolved)) {
    throw new Error(`protected release artifact blocks cleanup: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
}

function runDirectories(workflow) {
  const path = join(evidenceRoot, workflow);
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(path, entry.name))
    .filter(path => !existsSync(join(path, '.protected')))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function expiredEvidence() {
  if (!existsSync(evidenceRoot)) return [];
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const candidates = [];
  for (const entry of readdirSync(evidenceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const runs = runDirectories(entry.name);
    runs.forEach((path, index) => {
      if (
        !containsProtectedArtifact(path) &&
        (index >= maxRuns || statSync(path).mtimeMs < cutoff)
      )
        candidates.push(path);
    });
  }
  return [...new Set(candidates)];
}

function pruneEvidence() {
  for (const path of expiredEvidence())
    rmSync(path, { recursive: true, force: true });
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function begin() {
  const workflow = safeWorkflow(option('workflow'));
  const available = freeBytes();
  const emergency = process.env.AN_NATIVE_EMERGENCY_DISK_OVERRIDE === '1';
  mkdirSync(evidenceRoot, { recursive: true });
  mkdirSync(workspaceRoot, { recursive: true });
  const workflowWorkspace = join(workspaceRoot, workflow);
  const lockPath = join(workflowWorkspace, '.active.json');
  mkdirSync(workflowWorkspace, { recursive: true });
  const lock = activeLock(lockPath);
  if (lock) throw new Error(`active native build exists for ${workflow}`);
  if (available < refusalBytes && !emergency) {
    throw new Error(
      `only ${human(available)} free; refusing native build below ${human(
        refusalBytes,
      )}`,
    );
  }
  if (available < warningBytes) {
    console.error(`WARNING: only ${human(available)} free before native build`);
  }
  const runId =
    option('run-id') || new Date().toISOString().replaceAll(/[:.]/g, '-');
  const workspace = join(workflowWorkspace, runId);
  const evidence = join(evidenceRoot, workflow, runId);
  mkdirSync(workspace, { recursive: false });
  mkdirSync(evidence, { recursive: true });
  const payload = {
    pid: process.ppid,
    workflow,
    runId,
    workspace,
    evidence,
    startedAt: new Date().toISOString(),
    freeBefore: available,
  };
  let fd;
  try {
    fd = openSync(
      lockPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    writeFileSync(fd, `${JSON.stringify(payload, null, 2)}\n`);
  } catch (error) {
    rmSync(workspace, { recursive: true, force: true });
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  writeFileSync(
    join(evidence, 'run.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  if (hasFlag('shell')) {
    console.log(`AN_NATIVE_RUN_ID=${shellQuote(runId)}`);
    console.log(`AN_NATIVE_BUILD_WORKSPACE=${shellQuote(workspace)}`);
    console.log(`AN_NATIVE_EVIDENCE_DIR=${shellQuote(evidence)}`);
    console.log(`AN_NATIVE_FREE_BEFORE=${shellQuote(available)}`);
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function finish() {
  const workflow = safeWorkflow(option('workflow'));
  const runId = option('run-id');
  const status = option('status', 'failed');
  const workflowWorkspace = join(workspaceRoot, workflow);
  const lockPath = join(workflowWorkspace, '.active.json');
  const lock = readJson(lockPath);
  if (!lock || lock.runId !== runId)
    throw new Error(`active lock does not match ${workflow}/${runId}`);
  const workspace = lock.workspace;
  const evidence = lock.evidence;
  const workspaceBytes = byteSize(workspace);
  const retain =
    process.env.AN_RETAIN_NATIVE_BUILD_STATE === '1' ||
    hasFlag('retain-build-state');
  if (!retain) removeDisposable(workspace);
  rmSync(lockPath, { force: true });
  const after = freeBytes();
  const accounting = {
    workflow,
    runId,
    status,
    freeBefore: lock.freeBefore,
    freeAfter: after,
    workspaceBytes,
    evidenceBytes: byteSize(evidence),
    diagnosticBuildStateRetained: retain,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(evidence, 'accounting.json'),
    `${JSON.stringify(accounting, null, 2)}\n`,
  );
  pruneEvidence();
  console.log(`free disk before: ${human(accounting.freeBefore)}`);
  console.log(`free disk after: ${human(after)}`);
  console.log(`build workspace: ${human(workspaceBytes)}`);
  console.log(`retained evidence: ${human(byteSize(evidence))}`);
  console.log(`diagnostic build state retained: ${retain ? 'yes' : 'no'}`);
}

function maintenance() {
  mkdirSync(evidenceRoot, { recursive: true });
  mkdirSync(workspaceRoot, { recursive: true });
  const deleteMode = hasFlag('delete');
  const candidates = [];
  for (const entry of readdirSync(workspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const workflowPath = join(workspaceRoot, entry.name);
    if (activeLock(join(workflowPath, '.active.json'))) continue;
    for (const child of readdirSync(workflowPath, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      const path = join(workflowPath, child.name);
      candidates.push({
        path,
        kind: 'workspace',
        bytes: byteSize(path),
        protected: containsProtectedArtifact(path),
      });
    }
  }
  for (const path of expiredEvidence()) {
    candidates.push({
      path,
      kind: 'evidence',
      bytes: byteSize(path),
      protected: false,
    });
  }
  for (const candidate of candidates) {
    const state = candidate.protected
      ? 'PROTECTED'
      : deleteMode
      ? 'DELETE'
      : 'DRY-RUN';
    console.log(
      `${state}\t${candidate.kind}\t${human(candidate.bytes)}\t${
        candidate.path
      }`,
    );
    if (deleteMode && !candidate.protected) {
      if (candidate.kind === 'workspace') removeDisposable(candidate.path);
      else rmSync(candidate.path, { recursive: true, force: true });
    }
  }
  const reclaimable = candidates
    .filter(item => !item.protected)
    .reduce((sum, item) => sum + item.bytes, 0);
  console.log(`local usage: ${human(byteSize(localRoot))}`);
  console.log(`build workspace usage: ${human(byteSize(workspaceRoot))}`);
  console.log(
    `retained evidence runs: ${
      existsSync(evidenceRoot)
        ? readdirSync(evidenceRoot).flatMap(workflow =>
            runDirectories(workflow),
          ).length
        : 0
    }`,
  );
  console.log(
    `expired candidates: ${
      candidates.filter(item => item.kind === 'evidence').length
    }`,
  );
  console.log(`estimated reclaimable: ${human(reclaimable)}`);
  console.log(`mode: ${deleteMode ? 'delete' : 'dry-run'}`);
}

try {
  if (command === 'begin') begin();
  else if (command === 'finish') finish();
  else if (command === 'maintenance') maintenance();
  else throw new Error(`unknown command: ${command}`);
} catch (error) {
  console.error(`native-build-storage: ${error.message}`);
  process.exitCode = 1;
}
