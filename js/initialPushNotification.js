/* @flow */
'use strict';

import {
  boundedPushOperation,
  PUSH_OPERATION_TIMEOUT_MS,
} from './pushBoundedOperation';

export async function initialPushNotification(
  pushNotifications,
  timeoutMs = PUSH_OPERATION_TIMEOUT_MS.INITIAL_NOTIFICATION,
) {
  try {
    return await boundedPushOperation(
      () => pushNotifications.getInitialNotification(),
      { timeoutMs, timeoutCode: 'initial_notification_timeout' },
    );
  } catch {
    // Acquisition is opportunistic. Fail closed without blocking launch or
    // inventing a navigation destination.
    return null;
  }
}
