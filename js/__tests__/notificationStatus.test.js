import {
  canAttemptNotificationSetup,
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
});
