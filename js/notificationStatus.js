/* @flow */
'use strict';

export const NOTIFICATION_STATUS = Object.freeze({
  ENABLED: 'enabled',
  DISABLED_BY_USER: 'denied',
  SETUP_REQUIRED: 'unknown',
  DEVELOPMENT_BUILD_LIMITATION: 'development_build_limitation',
  TEMPORARY_ERROR: 'push_registration_failed',
});

export function pushEnvironmentCompatibility(
  apsEnvironment,
  runtimeEnvironment,
) {
  if (
    (apsEnvironment === 'development' && runtimeEnvironment === 'staging') ||
    (apsEnvironment === 'production' && runtimeEnvironment === 'production')
  ) {
    return 'compatible';
  }
  if (apsEnvironment === 'development' && runtimeEnvironment === 'production') {
    return NOTIFICATION_STATUS.DEVELOPMENT_BUILD_LIMITATION;
  }
  return NOTIFICATION_STATUS.TEMPORARY_ERROR;
}

export function canAttemptNotificationSetup(status) {
  return ![
    NOTIFICATION_STATUS.ENABLED,
    'working',
    NOTIFICATION_STATUS.DEVELOPMENT_BUILD_LIMITATION,
  ].includes(status);
}
