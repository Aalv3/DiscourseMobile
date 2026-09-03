jest.mock('../secureCredentialStore', () => ({
  credentialStore: { readSiteToken: jest.fn() },
}));

import { credentialStore } from '../secureCredentialStore';
import {
  browserSessionProbeUrl,
  collectStagingDiagnostics,
  stagingDiagnosticsEnabled,
} from '../stagingDiagnostics';

beforeEach(() => jest.clearAllMocks());

describe('staging certification diagnostics', () => {
  test('render only on the staging channel and fail closed elsewhere', () => {
    expect(stagingDiagnosticsEnabled('staging')).toBe(true);
    for (const channel of [
      'production',
      'preview',
      null,
      undefined,
      '',
      'STAGING',
    ]) {
      expect(stagingDiagnosticsEnabled(channel)).toBe(false);
    }
  });

  test('the browser probe targets the canonical session endpoint only', () => {
    expect(browserSessionProbeUrl('https://adjusternetwork.org')).toBe(
      'https://adjusternetwork.org/session/current.json',
    );
    expect(browserSessionProbeUrl(null)).toBeNull();
  });

  test('reports the active update identity for OTA activation proof', async () => {
    credentialStore.readSiteToken.mockResolvedValueOnce(null);
    const diagnostics = await collectStagingDiagnostics({
      isEnabled: true,
      updateId: 'update-id',
      runtimeVersion: 'an-ios-android-1.0.0-native-2',
      channel: 'staging',
      isEmbeddedLaunch: false,
      isEmergencyLaunch: false,
      manifest: { extra: { ota: { gitSha: 'abc123' } } },
    });

    expect(diagnostics).toMatchObject({
      gitSha: 'abc123',
      updateId: 'update-id',
      channel: 'staging',
      source: 'remote',
      runtimeVersion: 'an-ios-android-1.0.0-native-2',
      retainedCredential: 'absent',
    });
  });

  test('distinguishes an embedded launch from an activated remote update', async () => {
    credentialStore.readSiteToken.mockResolvedValueOnce(null);
    const diagnostics = await collectStagingDiagnostics({
      isEnabled: true,
      updateId: null,
      channel: 'staging',
      isEmbeddedLaunch: true,
      manifest: {},
    });

    expect(diagnostics.source).toBe('embedded');
    expect(diagnostics.gitSha).toBeNull();
  });

  test('reports a credential that survived reinstall without exposing it', async () => {
    credentialStore.readSiteToken.mockResolvedValueOnce('secret-user-api-key');
    const diagnostics = await collectStagingDiagnostics({
      isEnabled: true,
      channel: 'staging',
      manifest: {},
    });

    expect(diagnostics.retainedCredential).toBe('present');
    expect(JSON.stringify(diagnostics)).not.toContain('secret-user-api-key');
  });

  test('a Keychain read failure never blocks the diagnostics surface', async () => {
    credentialStore.readSiteToken.mockRejectedValueOnce(new Error('locked'));
    const diagnostics = await collectStagingDiagnostics({
      isEnabled: true,
      channel: 'staging',
      manifest: {},
    });

    expect(diagnostics.retainedCredential).toBe('unreadable');
  });
});
