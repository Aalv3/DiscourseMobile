import { getOtaDiagnostics } from '../otaDiagnostics';

jest.mock('expo-updates', () => ({}));

describe('OTA diagnostics', () => {
  test('exposes only release-identification and recovery state', () => {
    const diagnostics = getOtaDiagnostics({
      isEnabled: true,
      updateId: '4c420c20-2467-486a-a107-f09d71ca15dd',
      runtimeVersion: 'an-ios-android-1.0.0-native-1',
      channel: 'staging',
      isEmbeddedLaunch: false,
      isEmergencyLaunch: false,
      createdAt: new Date('2026-08-12T16:00:00.000Z'),
      manifest: {
        extra: { ota: { gitSha: 'a'.repeat(40) } },
        privatePayload: 'must-not-be-exposed',
      },
    });

    expect(diagnostics).toEqual({
      enabled: true,
      updateId: '4c420c20-2467-486a-a107-f09d71ca15dd',
      gitSha: 'a'.repeat(40),
      runtimeVersion: 'an-ios-android-1.0.0-native-1',
      channel: 'staging',
      source: 'remote',
      emergencyLaunch: false,
      createdAt: '2026-08-12T16:00:00.000Z',
    });
    expect(JSON.stringify(diagnostics)).not.toContain('privatePayload');
  });

  test('reports a safe embedded baseline when updates are disabled', () => {
    expect(
      getOtaDiagnostics({
        isEnabled: false,
        manifest: {},
        isEmbeddedLaunch: true,
        isEmergencyLaunch: true,
      }),
    ).toEqual({
      enabled: false,
      updateId: null,
      gitSha: null,
      runtimeVersion: null,
      channel: null,
      source: 'embedded',
      emergencyLaunch: true,
      createdAt: null,
    });
  });
});
