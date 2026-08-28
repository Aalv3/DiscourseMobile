import {
  canAttemptNotificationSetup,
  classifyPushRegistrationError,
  notificationSetupActionLabel,
  notificationStatusAfterRegistration,
  notificationStatusMessage,
  NOTIFICATION_STATUS,
  pushEnvironmentCompatibility,
} from '../notificationStatus';
import {
  completedPushRegistration,
  PUSH_HTTP_STATUS_CLASS,
  PUSH_REGISTRATION_CATEGORY,
  PUSH_REGISTRATION_STAGE,
  pushRegistrationResult,
} from '../pushRegistrationResult';

describe('notification status model', () => {
  test('allows only bounded configured runtime environments', () => {
    expect(pushEnvironmentCompatibility('production')).toBe('compatible');
    expect(pushEnvironmentCompatibility('staging')).toBe('compatible');
    expect(pushEnvironmentCompatibility(null)).toBe(
      NOTIFICATION_STATUS.TEMPORARY_ERROR,
    );
    expect(pushEnvironmentCompatibility('development')).toBe(
      NOTIFICATION_STATUS.TEMPORARY_ERROR,
    );
    expect(pushEnvironmentCompatibility('sandbox')).toBe(
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

  test('healthy registered push survives an unrelated authenticated API 429', () => {
    expect(
      notificationStatusAfterRegistration(NOTIFICATION_STATUS.ENABLED, null),
    ).toBe(NOTIFICATION_STATUS.ENABLED);
  });

  test('push-backend 429 preserves a previously registered device', () => {
    const result = pushRegistrationResult({
      stage: PUSH_REGISTRATION_STAGE.BACKEND_RESPONSE,
      category: PUSH_REGISTRATION_CATEGORY.BACKEND_RATE_LIMITED,
      httpStatusClass: PUSH_HTTP_STATUS_CLASS.RATE_LIMITED,
    });
    expect(
      notificationStatusAfterRegistration(NOTIFICATION_STATUS.ENABLED, result),
    ).toBe(NOTIFICATION_STATUS.ENABLED);
    expect(
      notificationStatusAfterRegistration(
        NOTIFICATION_STATUS.SETUP_REQUIRED,
        result,
      ),
    ).toBe(NOTIFICATION_STATUS.BACKEND_RATE_LIMITED);
  });

  test('successful retry becomes authoritative enabled state', () => {
    expect(
      notificationStatusAfterRegistration(
        NOTIFICATION_STATUS.BACKEND_RATE_LIMITED,
        completedPushRegistration(),
      ),
    ).toBe(NOTIFICATION_STATUS.ENABLED);
  });

  test('cold-launch restoration does not demote enabled push to working', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'Discourse.js'),
      'utf8',
    );
    const restore = source.slice(
      source.indexOf('this._pushFoundation\n          .status()'),
      source.indexOf('if (needsOnboardingDecision)'),
    );
    expect(restore).toContain("if (preference !== 'enabled') return;");
    expect(restore).not.toContain("pushStatus: 'working'");
    expect(restore).toContain('notificationStatusAfterRegistration');
  });
});
