/* @flow */
'use strict';

export const PUSH_REGISTRATION_STAGE = Object.freeze({
  PERMISSION_CHECK: 'permission_check',
  PERMISSION_REQUEST: 'permission_request',
  APNS_TOKEN: 'apns_token',
  INSTALLATION_IDENTITY: 'installation_identity',
  NONCE_GENERATION: 'nonce_generation',
  BACKEND_TRANSPORT: 'backend_transport',
  BACKEND_RESPONSE: 'backend_response',
  PREFERENCE_PERSISTENCE: 'preference_persistence',
  COMPLETED: 'completed',
  UNKNOWN: 'unknown',
});

export const PUSH_REGISTRATION_CATEGORY = Object.freeze({
  STARTED: 'started',
  STAGE_SUCCEEDED: 'stage_succeeded',
  ENABLED: 'enabled',
  PERMISSION_DENIED: 'permission_denied',
  PERMISSION_FAILURE: 'permission_failure',
  APNS_TOKEN_FAILURE: 'apns_token_failure',
  INSTALLATION_IDENTITY_FAILURE: 'installation_identity_failure',
  NONCE_FAILURE: 'nonce_failure',
  NETWORK_FAILURE: 'network_failure',
  BACKEND_REJECTION: 'backend_rejection',
  BACKEND_RATE_LIMITED: 'backend_rate_limited',
  PREFERENCE_PERSISTENCE_FAILURE: 'preference_persistence_failure',
  UNKNOWN_REGISTRATION_FAILURE: 'unknown_registration_failure',
});

export const PUSH_HTTP_STATUS_CLASS = Object.freeze({
  SUCCESS: '2xx',
  CLIENT_ERROR: '4xx',
  RATE_LIMITED: '429',
  SERVER_ERROR: '5xx',
  NONE: 'none',
});

const STAGES = new Set(Object.values(PUSH_REGISTRATION_STAGE));
const CATEGORIES = new Set(Object.values(PUSH_REGISTRATION_CATEGORY));
const HTTP_CLASSES = new Set(Object.values(PUSH_HTTP_STATUS_CLASS));

export function pushHttpStatusClass(status) {
  if (status === 429) return PUSH_HTTP_STATUS_CLASS.RATE_LIMITED;
  if (status >= 200 && status < 300) return PUSH_HTTP_STATUS_CLASS.SUCCESS;
  if (status >= 400 && status < 500) {
    return PUSH_HTTP_STATUS_CLASS.CLIENT_ERROR;
  }
  if (status >= 500 && status < 600) {
    return PUSH_HTTP_STATUS_CLASS.SERVER_ERROR;
  }
  return PUSH_HTTP_STATUS_CLASS.NONE;
}

export function pushRegistrationResult({
  stage,
  category,
  httpStatusClass = PUSH_HTTP_STATUS_CLASS.NONE,
  outcome = 'failed',
}) {
  return Object.freeze({
    stage: STAGES.has(stage) ? stage : PUSH_REGISTRATION_STAGE.UNKNOWN,
    category: CATEGORIES.has(category)
      ? category
      : PUSH_REGISTRATION_CATEGORY.UNKNOWN_REGISTRATION_FAILURE,
    httpStatusClass: HTTP_CLASSES.has(httpStatusClass)
      ? httpStatusClass
      : PUSH_HTTP_STATUS_CLASS.NONE,
    outcome: ['started', 'succeeded', 'failed'].includes(outcome)
      ? outcome
      : 'failed',
  });
}

export class PushRegistrationError extends Error {
  constructor(result) {
    super(result.category);
    this.name = 'PushRegistrationError';
    this.result = pushRegistrationResult(result);
  }
}

export function pushRegistrationFailure(stage, category, httpStatusClass) {
  return new PushRegistrationError({ stage, category, httpStatusClass });
}

export function resultFromPushError(error, fallbackStage) {
  if (error instanceof PushRegistrationError && error.result) {
    return error.result;
  }
  return pushRegistrationResult({
    stage: fallbackStage || PUSH_REGISTRATION_STAGE.UNKNOWN,
    category: PUSH_REGISTRATION_CATEGORY.UNKNOWN_REGISTRATION_FAILURE,
  });
}

export function startedPushRegistration(
  stage = PUSH_REGISTRATION_STAGE.PERMISSION_REQUEST,
) {
  return pushRegistrationResult({
    stage,
    category: PUSH_REGISTRATION_CATEGORY.STARTED,
    outcome: 'started',
  });
}

export function completedPushRegistration(
  httpStatusClass = PUSH_HTTP_STATUS_CLASS.SUCCESS,
) {
  return pushRegistrationResult({
    stage: PUSH_REGISTRATION_STAGE.COMPLETED,
    category: PUSH_REGISTRATION_CATEGORY.ENABLED,
    httpStatusClass,
    outcome: 'succeeded',
  });
}

export function succeededPushRegistrationStage(
  stage,
  httpStatusClass = PUSH_HTTP_STATUS_CLASS.NONE,
) {
  return pushRegistrationResult({
    stage,
    category: PUSH_REGISTRATION_CATEGORY.STAGE_SUCCEEDED,
    httpStatusClass,
    outcome: 'succeeded',
  });
}
