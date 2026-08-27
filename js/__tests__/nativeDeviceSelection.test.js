const { spawnSync } = require('child_process');
const { join } = require('path');

const root = join(__dirname, '..', '..');
const helper = join(root, 'scripts', 'native-device-selection.mjs');

function select(devices, identifier = null) {
  const script = `
    import { selectPhysicalIPhone } from ${JSON.stringify(
      `file:///${helper.replace(/\\/g, '/')}`,
    )};
    const devices = JSON.parse(process.env.DEVICES);
    try {
      console.log(JSON.stringify(selectPhysicalIPhone(devices, process.env.IDENTIFIER || undefined)));
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  `;
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      DEVICES: JSON.stringify(devices),
      IDENTIFIER: identifier || '',
    },
  });
}

const observed = {
  identifier: 'D96A9236-6B0C-50F2-AC2F-6B1C5881F469',
  hardwareProperties: {
    platform: 'iOS',
    reality: 'physical',
    deviceType: 'iPhone',
    marketingName: 'iPhone 15 Pro (iPhone16,1)',
  },
  deviceProperties: { name: "Alex's iPhone" },
  connectionProperties: {
    pairingState: 'paired',
    tunnelState: 'disconnected',
    transportType: 'localNetwork',
  },
  displayState: 'available (paired)',
};

describe('CoreDevice physical iPhone selection', () => {
  test('accepts the observed available (paired) iPhone', () => {
    const result = select([observed]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).identifier).toBe(observed.identifier);
  });

  test.each([
    { pairingState: 'unpaired', tunnelState: 'connected' },
    { pairingState: 'paired', tunnelState: 'unavailable' },
  ])('rejects unavailable or unpaired devices: %j', connectionProperties => {
    const result = select([{ ...observed, connectionProperties }]);
    expect(result.status).toBe(1);
  });

  test('requires an explicit identifier when multiple phones are eligible', () => {
    const other = { ...observed, identifier: 'OTHER-PHYSICAL-IPHONE' };
    expect(select([observed, other]).status).toBe(1);
    const selected = select([observed, other], observed.identifier);
    expect(selected.status).toBe(0);
    expect(JSON.parse(selected.stdout).identifier).toBe(observed.identifier);
  });

  test('rejects an explicit identifier that is not eligible', () => {
    expect(select([observed], 'UNKNOWN')).toMatchObject({ status: 1 });
  });
});
