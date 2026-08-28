/* @flow */
'use strict';

export const NOTIFICATION_STATUS = Object.freeze({
  ENABLED: 'enabled',
  DISABLED_BY_USER: 'denied',
  PERMISSION_DENIED: 'permission_denied',
  PERMISSION_FAILURE: 'permission_failure',
  SETUP_REQUIRED: 'unknown',
  DEVELOPMENT_BUILD_LIMITATION: 'development_build_limitation',
  TEMPORARY_ERROR: 'push_registration_failed',
  APNS_TOKEN_FAILURE: 'apns_token_failure',
  INSTALLATION_IDENTITY_FAILURE: 'installation_identity_failure',
  BACKEND_REJECTION: 'backend_rejection',
  BACKEND_RATE_LIMITED: 'backend_rate_limited',
  NONCE_FAILURE: 'nonce_failure',
  NETWORK_FAILURE: 'network_failure',
  UNKNOWN_REGISTRATION_FAILURE: 'unknown_registration_failure',
  PREFERENCE_PERSISTENCE_FAILURE: 'preference_persistence_failure',
});

const SAFE_FAILURES = new Set([
  NOTIFICATION_STATUS.APNS_TOKEN_FAILURE,
  NOTIFICATION_STATUS.INSTALLATION_IDENTITY_FAILURE,
  NOTIFICATION_STATUS.BACKEND_REJECTION,
  NOTIFICATION_STATUS.BACKEND_RATE_LIMITED,
  NOTIFICATION_STATUS.NONCE_FAILURE,
  NOTIFICATION_STATUS.NETWORK_FAILURE,
  NOTIFICATION_STATUS.UNKNOWN_REGISTRATION_FAILURE,
  NOTIFICATION_STATUS.PERMISSION_FAILURE,
  NOTIFICATION_STATUS.PREFERENCE_PERSISTENCE_FAILURE,
]);

export function classifyPushRegistrationError(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (SAFE_FAILURES.has(message)) return message;
  if (message === 'push_token_failed' || message === 'push_token_timeout') {
    return NOTIFICATION_STATUS.APNS_TOKEN_FAILURE;
  }
  if (message === 'push_installation_failed') {
    return NOTIFICATION_STATUS.INSTALLATION_IDENTITY_FAILURE;
  }
  if (message === 'push_backend_nonce_unavailable') {
    return NOTIFICATION_STATUS.NONCE_FAILURE;
  }
  if (
    message === 'push_temporarily_unavailable' ||
    message === 'push_backend_rejected_429'
  ) {
    return NOTIFICATION_STATUS.BACKEND_RATE_LIMITED;
  }
  if (
    message === 'push_backend_rejected_transport' ||
    message === 'network_request_failed' ||
    error?.name === 'TypeError'
  ) {
    return NOTIFICATION_STATUS.NETWORK_FAILURE;
  }
  if (
    message === 'push_backend_failed' ||
    message === 'push_backend_unconfigured' ||
    /^push_backend_rejected_[1-5][0-9]{2}$/.test(message)
  ) {
    return NOTIFICATION_STATUS.BACKEND_REJECTION;
  }
  return NOTIFICATION_STATUS.UNKNOWN_REGISTRATION_FAILURE;
}

export function pushEnvironmentCompatibility(runtimeEnvironment) {
  return runtimeEnvironment === 'staging' || runtimeEnvironment === 'production'
    ? 'compatible'
    : NOTIFICATION_STATUS.TEMPORARY_ERROR;
}

export function canAttemptNotificationSetup(status) {
  return ![
    NOTIFICATION_STATUS.ENABLED,
    'working',
    NOTIFICATION_STATUS.DEVELOPMENT_BUILD_LIMITATION,
  ].includes(status);
}

export function notificationStatusAfterRegistration(previousStatus, result) {
  if (
    previousStatus === NOTIFICATION_STATUS.ENABLED &&
    result?.outcome === 'failed'
  ) {
    return NOTIFICATION_STATUS.ENABLED;
  }
  return result?.category || previousStatus;
}

export function notificationSetupActionLabel(status) {
  if (status === NOTIFICATION_STATUS.PERMISSION_DENIED) return 'Open Settings';
  return [
    NOTIFICATION_STATUS.DISABLED_BY_USER,
    NOTIFICATION_STATUS.SETUP_REQUIRED,
  ].includes(status)
    ? 'Enable notifications'
    : 'Try again';
}

export function notificationStatusMessage(status) {
  switch (status) {
    case NOTIFICATION_STATUS.ENABLED:
      return 'Important member activity is enabled for this device.';
    case 'working':
      return 'Finishing secure registration for this device…';
    case NOTIFICATION_STATUS.DEVELOPMENT_BUILD_LIMITATION:
      return 'Notifications are unavailable in this development build.';
    case NOTIFICATION_STATUS.DISABLED_BY_USER:
      return 'Notifications are off. You can keep using every member feature.';
    case NOTIFICATION_STATUS.PERMISSION_DENIED:
      return 'Notifications are blocked in iOS Settings. You can change this at any time.';
    case NOTIFICATION_STATUS.PERMISSION_FAILURE:
      return 'iOS notification access could not be checked right now.';
    case NOTIFICATION_STATUS.APNS_TOKEN_FAILURE:
      return 'This device could not finish notification setup. Try again in a moment.';
    case NOTIFICATION_STATUS.INSTALLATION_IDENTITY_FAILURE:
      return 'Secure notification setup could not finish on this device.';
    case NOTIFICATION_STATUS.BACKEND_RATE_LIMITED:
      return 'Notification setup is cooling down briefly. Try again later.';
    case NOTIFICATION_STATUS.BACKEND_REJECTION:
    case NOTIFICATION_STATUS.NONCE_FAILURE:
      return 'Secure notification registration could not finish right now.';
    case NOTIFICATION_STATUS.NETWORK_FAILURE:
      return 'Notification setup needs a network connection. Try again when connected.';
    case NOTIFICATION_STATUS.UNKNOWN_REGISTRATION_FAILURE:
      return 'Notification setup encountered an unexpected problem.';
    case NOTIFICATION_STATUS.PREFERENCE_PERSISTENCE_FAILURE:
      return 'This device registered, but its notification setting could not be saved.';
    case NOTIFICATION_STATUS.TEMPORARY_ERROR:
      return 'This device is not registered for alerts right now.';
    default:
      return 'Choose whether this device may alert you to important member activity. No marketing.';
  }
}

export function notificationAttemptMessage(result) {
  if (!result) return null;
  if (result.outcome === 'started') return 'Trying notification setup…';
  if (result.outcome === 'succeeded') return 'Notifications are now enabled.';
  return `Try again did not complete. ${notificationStatusMessage(
    result.category,
  )}`;
}
