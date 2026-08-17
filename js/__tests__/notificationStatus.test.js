import {
  canAttemptNotificationSetup,
  classifyPushRegistrationError,
  notificationSetupActionLabel,
  notificationStatusMessage,
  NOTIFICATION_STATUS,
  pushEnvironmentCompatibility,
} from '../notificationStatus';

describe('notification status model', () => {
  test('classifies development-signed Release without attempting production registration', () => {
    expect(pushEnvironmentCompatibility('development', 'production')).toBe(
      NOTIFICATION_STATUS.DEVELOPMENT_BUILD_LIMITATION,
    );
    expect(
      canAttemptNotificationSetup(
        NOTIFICATION_STATUS.DEVELOPMENT_BUILD_LIMITATION,
      ),
    ).toBe(false);
  });

  test('allows only compatible trusted APNs/runtime pairs', () => {
    expect(pushEnvironmentCompatibility('production', 'production')).toBe(
      'compatible',
    );
    expect(pushEnvironmentCompatibility('development', 'staging')).toBe(
      'compatible',
    );
    expect(pushEnvironmentCompatibility(null, 'production')).toBe(
      NOTIFICATION_STATUS.TEMPORARY_ERROR,
    );
  });

  test.each([
    [NOTIFICATION_STATUS.ENABLED, false],
    [NOTIFICATION_STATUS.DISABLED_BY_USER, true],
    [NOTIFICATION_STATUS.SETUP_REQUIRED, true],
    [NOTIFICATION_STATUS.TEMPORARY_ERROR, true],
  ])('maps %s to actionable=%s', (status, actionable) => {
    expect(canAttemptNotificationSetup(status)).toBe(actionable);
  });

  test.each([
    ['push_token_failed', NOTIFICATION_STATUS.APNS_TOKEN_FAILURE],
    [
      'push_installation_failed',
      NOTIFICATION_STATUS.INSTALLATION_IDENTITY_FAILURE,
    ],
    ['push_backend_rejected_403', NOTIFICATION_STATUS.BACKEND_REJECTION],
    ['push_backend_rejected_429', NOTIFICATION_STATUS.BACKEND_RATE_LIMITED],
    ['push_backend_nonce_unavailable', NOTIFICATION_STATUS.NONCE_FAILURE],
    ['push_backend_rejected_transport', NOTIFICATION_STATUS.NETWORK_FAILURE],
    [
      'private provider detail',
      NOTIFICATION_STATUS.UNKNOWN_REGISTRATION_FAILURE,
    ],
  ])('maps %s to privacy-safe category %s', (raw, expected) => {
    expect(classifyPushRegistrationError(new Error(raw))).toBe(expected);
  });

  test('uses retry language after a registration failure', () => {
    expect(
      notificationSetupActionLabel(NOTIFICATION_STATUS.NETWORK_FAILURE),
    ).toBe('Try again');
    expect(
      notificationSetupActionLabel(NOTIFICATION_STATUS.SETUP_REQUIRED),
    ).toBe('Enable notifications');
    expect(
      notificationSetupActionLabel(NOTIFICATION_STATUS.PERMISSION_DENIED),
    ).toBe('Open Settings');
    expect(
      notificationStatusMessage(NOTIFICATION_STATUS.NONCE_FAILURE),
    ).not.toMatch(/nonce|backend|token/i);
  });
});
