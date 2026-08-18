const { spawnSync } = require('child_process');
const { readFileSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..', '..');
const devex = join(root, 'scripts', 'native-devex.mjs');

describe('canonical native development workflow', () => {
  test.each(['js', 'ota', 'native', 'system'])(
    '%s validation is available as a dry-run command',
    lane => {
      const result = spawnSync(
        process.execPath,
        [devex, 'validate', `--lane=${lane}`, '--dry-run'],
        {
          cwd: root,
          encoding: 'utf8',
        },
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`LANE ${lane}`);
      expect(result.stdout).toContain('PASS evidence=');
    },
  );

  test('OTA promotion requires one immutable certified group', () => {
    const missing = spawnSync(
      process.execPath,
      [devex, 'ota-promote', '--dry-run'],
      {
        cwd: root,
        encoding: 'utf8',
      },
    );
    expect(missing.status).toBe(1);
    const result = spawnSync(
      process.execPath,
      [
        devex,
        'ota-promote',
        '--group=5cf1cdf5-80a5-4213-878d-edb68fc5b368',
        '--dry-run',
      ],
      { cwd: root, encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--destination-channel production');
  });

  test('permanent staging build is remote-update-first while production has recovery bundle', () => {
    const script = `
      process.env.AN_OTA_CHANNEL='staging';
      const staging=require('./app.config.js');
      delete require.cache[require.resolve('./app.config.js')];
      process.env.AN_OTA_CHANNEL='production';
      const production=require('./app.config.js');
      console.log(JSON.stringify([staging.updates.useEmbeddedUpdate,production.updates.useEmbeddedUpdate]));
    `;
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.stdout.trim()).toBe('[false,true]');
  });

  test('physical diagnostics are durable, bounded and contain no secret fields', () => {
    const native = readFileSync(
      join(root, 'ios', 'DiscourseKeyboardShortcuts.m'),
      'utf8',
    );
    const harness = readFileSync(
      join(root, 'scripts', 'native-device-harness.mjs'),
      'utf8',
    );
    expect(native).toContain('push-registration.ndjson');
    expect(native).toContain('existing.length > 65536');
    expect(harness).toMatch(
      /new Set\(\[\s*'timestamp',\s*'stage',\s*'category',\s*'http',\s*'outcome',?\s*\]\)/,
    );
    expect(native).not.toMatch(/@"(token|nonce|installationId|auth)"/i);
  });
});
