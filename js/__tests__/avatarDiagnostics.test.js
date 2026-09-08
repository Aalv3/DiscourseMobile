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
  recordAvatarImageEvent,
  recordAvatarResolution,
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
    expect(source).toContain('source={memberImageSource(site, resolvedUri)}');
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
