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
});
