import {
  AUTH_FAILURE,
  authFailureAlert,
  classifyAuthFailure,
} from '../authFailure';

describe('authentication failure categories', () => {
  test.each([
    ['auth_user_cancelled', AUTH_FAILURE.USER_CANCEL],
    ['auth_presentation_unavailable', AUTH_FAILURE.PRESENTATION],
    ['auth_start_failed', AUTH_FAILURE.PRESENTATION],
    ['auth_session_failed', AUTH_FAILURE.PRESENTATION],
    ['rsa_key_generation_failed', AUTH_FAILURE.KEYCHAIN],
    ['keychain_unavailable', AUTH_FAILURE.KEYCHAIN],
    ['auth_invalid_url', AUTH_FAILURE.AUTH_URL],
    ['auth_origin_not_allowed', AUTH_FAILURE.AUTH_URL],
    ['auth_callback_invalid', AUTH_FAILURE.CALLBACK],
    ['auth_payload_rejected', AUTH_FAILURE.CALLBACK],
    ['Network request failed', AUTH_FAILURE.NETWORK],
  ])('classifies %s', (code, category) => {
    expect(classifyAuthFailure(Object.assign(new Error(code), { code }))).toBe(
      category,
    );
  });

  test('uses privacy-safe category-specific member copy', () => {
    expect(authFailureAlert(AUTH_FAILURE.PRESENTATION)).toEqual({
      title: 'Sign-in could not open',
      message:
        'The secure sign-in window could not be opened. Please try again.',
    });
    expect(JSON.stringify(authFailureAlert(AUTH_FAILURE.CALLBACK))).not.toMatch(
      /token|payload|nonce|url/i,
    );
  });

  // Regression: the staging certification lane surfaced OSStatus -34018
  // ("Client has neither application-identifier nor keychain-access-groups
  // entitlements") as "Unable to connect", which pointed operators at
  // connectivity instead of the real signing/entitlement defect.
  describe('security configuration failures are never network failures', () => {
    const securityFailures = [
      'The operation couldn’t be completed. (OSStatus error -34018.)',
      'Client has neither application-identifier nor keychain-access-groups entitlements',
      'errSecMissingEntitlement',
      'SecItemCopyMatching failed',
      'secure_storage_unavailable',
    ];

    test.each(securityFailures)('classifies %s as keychain', message => {
      expect(classifyAuthFailure(new Error(message))).toBe(
        AUTH_FAILURE.KEYCHAIN,
      );
    });

    test.each(securityFailures)('never shows network copy for %s', message => {
      const alert = authFailureAlert(classifyAuthFailure(new Error(message)));
      expect(alert.title).not.toBe('Unable to connect');
      expect(alert).toEqual({
        title: 'Secure sign-in unavailable',
        message: 'Secure sign-in could not be prepared. Please try again.',
      });
    });

    test('classifies a numeric-code keychain rejection by its message', () => {
      const error = Object.assign(new Error('OSStatus error -34018'), {
        code: '-34018',
      });
      expect(classifyAuthFailure(error)).toBe(AUTH_FAILURE.KEYCHAIN);
    });
  });

  describe('unknown and programming faults do not borrow network copy', () => {
    const unknownFailures = [
      new TypeError('undefined is not a function'),
      new TypeError("Cannot read property 'requestAuth' of undefined"),
      new Error('something entirely unexpected'),
      new Error(''),
      undefined,
      null,
    ];

    test.each(unknownFailures.map((e, i) => [i, e]))(
      'classifies unknown fault %i as UNKNOWN',
      (_index, error) => {
        expect(classifyAuthFailure(error)).toBe(AUTH_FAILURE.UNKNOWN);
      },
    );

    test('unknown copy is bounded and not connectivity-flavoured', () => {
      const alert = authFailureAlert(AUTH_FAILURE.UNKNOWN);
      expect(alert.title).not.toBe('Unable to connect');
      expect(alert.message).not.toMatch(/connect|network|offline|internet/i);
      expect(alert.title).toBe('Sign-in could not be completed');
    });
  });

  describe('genuine transport failures keep existing behaviour', () => {
    test.each([
      'Network request failed',
      'The request timed out',
      'The Internet connection appears to be offline.',
      'Could not connect to the server',
      'getaddrinfo ENOTFOUND staging.adjusternetwork.org',
    ])('classifies %s as network', message => {
      expect(classifyAuthFailure(new Error(message))).toBe(
        AUTH_FAILURE.NETWORK,
      );
    });

    test('network copy is unchanged from the shipped build', () => {
      expect(authFailureAlert(AUTH_FAILURE.NETWORK)).toEqual({
        title: 'Unable to connect',
        message: 'Please try again in a moment.',
      });
    });
  });

  test('every category maps to bounded non-empty copy', () => {
    Object.values(AUTH_FAILURE).forEach(category => {
      const alert = authFailureAlert(category);
      expect(alert.title.length).toBeGreaterThan(0);
      expect(alert.message.length).toBeGreaterThan(0);
      expect(/^[a-z0-9_.-]{1,64}$/.test(category)).toBe(true);
    });
  });
});
