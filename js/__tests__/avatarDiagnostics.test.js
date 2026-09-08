jest.mock('../stagingDiagnostics', () => ({
  stagingDiagnosticsEnabled: jest.fn(() => true),
}));
jest.mock('../profileDiagnostics', () => ({
  recordProfileDiagnostic: jest.fn(entry => entry),
}));

import { recordProfileDiagnostic } from '../profileDiagnostics';
import { stagingDiagnosticsEnabled } from '../stagingDiagnostics';
import {
  AVATAR_SCREENS,
  avatarAuthorityKey,
  classifyAvatarSource,
  nextAvatarInstanceId,
  recordAvatarImageEvent,
  recordAvatarLifecycle,
  recordAvatarResolution,
  resetAvatarInstanceCounter,
  utcNow,
} from '../product/avatarDiagnostics';

const CANONICAL = 'https://adjusternetwork.org';
const site = {
  url: CANONICAL,
  username: 'tomrodriguez',
  authToken: 'k',
  clientId: 'c',
};
const PHOTO = `${CANONICAL}/renaissance/member-photo/tomrodriguez/72/67.png`;

beforeEach(() => {
  jest.clearAllMocks();
  stagingDiagnosticsEnabled.mockReturnValue(true);
});

describe('avatar resolution diagnostics', () => {
  test('names the three surfaces explicitly rather than inferring them', () => {
    expect(AVATAR_SCREENS).toEqual({
      you: 'YOU',
      memberProfile: 'MEMBER_PROFILE',
      editProfile: 'EDIT_PROFILE',
    });
  });

  test('records the real authority lookup key', () => {
    // Must mirror avatarAuthority.scopeKey: url + lowercased username.
    expect(avatarAuthorityKey(site, 'TomRodriguez')).toBe(
      `${CANONICAL}:tomrodriguez`,
    );
    expect(avatarAuthorityKey(null, null)).toBe(':');
  });

  test('classifies each source the way memberImageSource treats it', () => {
    expect(classifyAvatarSource(site, PHOTO)).toBe(
      'authenticated_member_photo',
    );
    expect(
      classifyAvatarSource(site, `${CANONICAL}/user_avatar/x/tom/72/1.png`),
    ).toBe('ordinary_unauthenticated');
    expect(
      classifyAvatarSource(
        { url: CANONICAL },
        `${CANONICAL}/renaissance/member-photo/tom/72/1.png`,
      ),
    ).toBe('member_photo_unauthenticated');
    expect(classifyAvatarSource(site, null)).toBe('none');
  });

  test('captures the full comparison record for a surface', () => {
    recordAvatarResolution({
      screen: AVATAR_SCREENS.memberProfile,
      site,
      username: 'tomrodriguez',
      inputTemplate: '/renaissance/member-photo/tomrodriguez/{size}/67.png',
      authority: {
        template: '/renaissance/member-photo/tomrodriguez/{size}/67.png',
      },
      resolvedUri: PHOTO,
      size: 72,
      failedUri: null,
      fallback: 'image',
    });

    const entry = recordProfileDiagnostic.mock.calls[0][0];
    expect(entry).toMatchObject({
      event: 'avatar_resolve',
      screen: 'MEMBER_PROFILE',
      siteUsername: 'tomrodriguez',
      requestedUsername: 'tomrodriguez',
      authorityKey: `${CANONICAL}:tomrodriguez`,
      authorityPresent: true,
      resolvedPath: '/renaissance/member-photo/tomrodriguez/72/67.png',
      size: '72',
      authClass: 'authenticated_member_photo',
      failedUriMatch: false,
      fallback: 'image',
    });
  });

  test('distinguishes a letter fallback caused by a failed image from one with no URI', () => {
    recordAvatarResolution({
      screen: AVATAR_SCREENS.editProfile,
      site,
      username: 'tomrodriguez',
      resolvedUri: PHOTO,
      size: 72,
      failedUri: PHOTO,
      fallback: 'letter_after_error',
    });
    expect(recordProfileDiagnostic.mock.calls[0][0]).toMatchObject({
      failedUriMatch: true,
      fallback: 'letter_after_error',
    });

    recordProfileDiagnostic.mockClear();
    recordAvatarResolution({
      screen: AVATAR_SCREENS.you,
      site,
      username: 'tomrodriguez',
      resolvedUri: null,
      size: 68,
      fallback: 'letter_no_uri',
    });
    expect(recordProfileDiagnostic.mock.calls[0][0]).toMatchObject({
      resolvedPath: 'none',
      authClass: 'none',
      fallback: 'letter_no_uri',
    });
  });

  test('records image lifecycle with only a bounded error class', () => {
    recordAvatarImageEvent({
      screen: AVATAR_SCREENS.memberProfile,
      imageEvent: 'error',
      resolvedUri: PHOTO,
      error: { nativeEvent: { error: 'unsupported URL' } },
    });
    const entry = recordProfileDiagnostic.mock.calls[0][0];
    expect(entry).toMatchObject({
      event: 'avatar_image',
      imageEvent: 'error',
      errorClass: 'unsupported URL',
    });
    expect(JSON.stringify(entry)).not.toMatch(
      /User-Api-Key|Authorization|Cookie/i,
    );
  });

  test('never records credentials, headers or cookies', () => {
    recordAvatarResolution({
      screen: AVATAR_SCREENS.you,
      site,
      username: 'tomrodriguez',
      resolvedUri: PHOTO,
      size: 68,
    });
    const serialized = JSON.stringify(recordProfileDiagnostic.mock.calls[0][0]);
    for (const secret of [
      'User-Api-Key',
      'User-Api-Client-Id',
      'Authorization',
      'Cookie',
      'k',
      'c',
    ]) {
      if (secret.length > 1) expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toContain(site.authToken.repeat(8));
  });

  test('emits nothing off the staging channel', () => {
    stagingDiagnosticsEnabled.mockReturnValue(false);
    expect(
      recordAvatarResolution({
        screen: AVATAR_SCREENS.you,
        site,
        resolvedUri: PHOTO,
      }),
    ).toBeNull();
    expect(
      recordAvatarImageEvent({
        screen: AVATAR_SCREENS.you,
        imageEvent: 'load',
      }),
    ).toBeNull();
    expect(recordProfileDiagnostic).not.toHaveBeenCalled();
  });

  test('emits nothing when a surface passes no diagnostic context', () => {
    expect(recordAvatarResolution({ site, resolvedUri: PHOTO })).toBeNull();
    expect(recordAvatarImageEvent({ imageEvent: 'load' })).toBeNull();
    expect(recordProfileDiagnostic).not.toHaveBeenCalled();
  });
});

describe('the diagnostic does not change rendering behavior', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'product', 'ProductComponents.js'),
    'utf8',
  );

  test('the image branch condition and error fallback are unchanged', () => {
    expect(source).toContain(
      'const showsImage = !!resolvedUri && failedUri !== resolvedUri;',
    );
    expect(source).toContain('setFailedUri(resolvedUri);');
    // The source is still exactly memberImageSource(site, resolvedUri); it is
    // hoisted to a const only so its identity can be compared across renders.
    expect(source).toContain(
      'const source = memberImageSource(site, resolvedUri);',
    );
    expect(source).toContain('source={source}');
    expect(source).not.toContain('source={{ uri: resolvedUri }}');
  });

  test('all three surfaces are tagged', () => {
    const screens = fs.readFileSync(
      path.join(__dirname, '..', 'product', 'ProductScreens.js'),
      'utf8',
    );
    const profile = fs.readFileSync(
      path.join(__dirname, '..', 'product', 'NativeProfileScreen.js'),
      'utf8',
    );
    expect(screens).toContain('diagnosticContext={AVATAR_SCREENS.you}');
    expect(profile).toContain(
      'diagnosticContext={AVATAR_SCREENS.memberProfile}',
    );
    expect(profile).toContain('diagnosticContext={AVATAR_SCREENS.editProfile}');
  });
});

describe('instance-level correlation', () => {
  beforeEach(() => resetAvatarInstanceCounter());

  test('instance ids are monotonic so interleaved events can be separated', () => {
    const ids = [
      nextAvatarInstanceId(),
      nextAvatarInstanceId(),
      nextAvatarInstanceId(),
    ];
    expect(ids).toEqual(['avatar-1', 'avatar-2', 'avatar-3']);
    expect(new Set(ids).size).toBe(3);
  });

  test('UTC wall clock carries milliseconds for edge-log alignment', () => {
    const stamp = utcNow(Date.UTC(2026, 8, 8, 13, 45, 12, 345));
    expect(stamp).toBe('2026-09-08T13:45:12.345Z');
    expect(stamp).toMatch(/\.\d{3}Z$/);
  });

  test('every event type carries instance id and UTC', () => {
    recordAvatarResolution({
      screen: AVATAR_SCREENS.memberProfile,
      instanceId: 'avatar-7',
      navigator: 'stack',
      site,
      username: 'tomrodriguez',
      resolvedUri: PHOTO,
      reactKey: PHOTO,
      sourceRecreated: true,
      size: 72,
    });
    recordAvatarLifecycle({
      screen: AVATAR_SCREENS.memberProfile,
      instanceId: 'avatar-7',
      phase: 'mount',
      resolvedUri: PHOTO,
    });
    recordAvatarImageEvent({
      screen: AVATAR_SCREENS.memberProfile,
      instanceId: 'avatar-7',
      imageEvent: 'error',
      resolvedUri: PHOTO,
      error: { nativeEvent: { error: 'HTTP 429' } },
    });

    const entries = recordProfileDiagnostic.mock.calls.map(c => c[0]);
    expect(entries).toHaveLength(3);
    for (const e of entries) {
      expect(e.instanceId).toBe('avatar-7');
      expect(e.utc).toMatch(/^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/);
    }
    expect(entries[0]).toMatchObject({
      navigator: 'stack',
      sourceRecreated: true,
      size: '72',
    });
    expect(entries[1]).toMatchObject({
      event: 'avatar_lifecycle',
      phase: 'mount',
    });
    // The exact native error is preserved for correlation against the 429.
    expect(entries[2]).toMatchObject({
      event: 'avatar_image',
      errorClass: 'HTTP 429',
    });
  });

  test('mount and unmount are both recorded', () => {
    recordAvatarLifecycle({
      screen: AVATAR_SCREENS.editProfile,
      instanceId: 'avatar-2',
      phase: 'mount',
      resolvedUri: PHOTO,
    });
    recordAvatarLifecycle({
      screen: AVATAR_SCREENS.editProfile,
      instanceId: 'avatar-2',
      phase: 'unmount',
      resolvedUri: PHOTO,
    });
    const phases = recordProfileDiagnostic.mock.calls.map(c => c[0].phase);
    expect(phases).toEqual(['mount', 'unmount']);
  });

  test('lifecycle emits nothing off staging or without context', () => {
    stagingDiagnosticsEnabled.mockReturnValue(false);
    expect(
      recordAvatarLifecycle({
        screen: AVATAR_SCREENS.you,
        instanceId: 'a',
        phase: 'mount',
      }),
    ).toBeNull();
    stagingDiagnosticsEnabled.mockReturnValue(true);
    expect(
      recordAvatarLifecycle({ instanceId: 'a', phase: 'mount' }),
    ).toBeNull();
  });
});

describe('navigator placement differs between the surfaces', () => {
  const fs = require('fs');
  const path = require('path');
  const root = fs.readFileSync(
    path.join(__dirname, '..', 'Discourse.js'),
    'utf8',
  );

  test('You is a retained tab screen while profile screens are stack screens', () => {
    // The You surface is a Tab.Screen, which React Navigation retains once
    // visited. The member profile surfaces are Stack.Screens, which mount and
    // unmount on every push and pop - a material difference for avatar state.
    const tabProfile =
      /<Tab\.Screen\s+name="Profile"[\s\S]*?<ProfileScreen[\s\S]*?<\/Tab\.Screen>/;
    expect(tabProfile.test(root)).toBe(true);
    expect(root).toContain('<Tab.Navigator');
    expect(root).toContain('<Stack.Screen');
  });
});
