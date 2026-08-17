/* @flow */
'use strict';

import { NativeModules } from 'react-native';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { PUSH_OPERATION_TIMEOUT_MS } from '../pushBoundedOperation';

const { DiscourseKeyboardShortcuts } = NativeModules;

let currentToken = null;
let tokenWaiters = [];

// Observe the native APNs callback from module load so the one-time token
// cannot race the later backend-registration step. The token remains
// memory-only.
PushNotificationIOS.addEventListener('register', token => {
  currentToken = token;
  const waiters = tokenWaiters;
  tokenWaiters = [];
  waiters.forEach(waiter => waiter.resolve(token));
});
PushNotificationIOS.addEventListener('registrationError', () => {
  const waiters = tokenWaiters;
  tokenWaiters = [];
  waiters.forEach(waiter => waiter.reject(new Error('push_token_failed')));
});

function permissionState() {
  return Promise.resolve(
    DiscourseKeyboardShortcuts?.notificationAuthorizationState?.(),
  ).then(state => {
    switch (state) {
      case 'authorized':
      case 'provisional':
      case 'ephemeral':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'notDetermined':
        return 'not_determined';
      default:
        return 'unknown';
    }
  });
}

export const pushTransport = Object.freeze({
  platform: 'ios',
  permissionState,
  async requestPermission() {
    const state =
      await DiscourseKeyboardShortcuts?.requestNotificationAuthorization?.();
    return ['authorized', 'provisional', 'ephemeral'].includes(state)
      ? 'granted'
      : state === 'denied'
      ? 'denied'
      : 'unknown';
  },
  token() {
    if (currentToken) return Promise.resolve(currentToken);
    return Promise.resolve(
      DiscourseKeyboardShortcuts?.consumeAPNSToken?.(),
    ).then(pendingToken => {
      if (pendingToken) {
        currentToken = pendingToken;
        return pendingToken;
      }
      return Promise.resolve(
        DiscourseKeyboardShortcuts?.consumeAPNSRegistrationFailure?.(),
      ).then(pendingFailure => {
        if (pendingFailure) {
          throw new Error('push_token_failed');
        }
        return new Promise((resolve, reject) => {
          const waiter = {
            resolve: token => {
              clearTimeout(timeout);
              resolve(token);
            },
            reject: error => {
              clearTimeout(timeout);
              reject(error);
            },
          };
          const timeout = setTimeout(() => {
            tokenWaiters = tokenWaiters.filter(item => item !== waiter);
            reject(new Error('push_token_timeout'));
          }, PUSH_OPERATION_TIMEOUT_MS.APNS_TOKEN);
          tokenWaiters.push(waiter);
          DiscourseKeyboardShortcuts?.registerForRemoteNotifications?.();
        });
      });
    });
  },
  onTokenRefresh(handler) {
    PushNotificationIOS.addEventListener('register', handler);
    return {
      remove: () =>
        PushNotificationIOS.removeEventListener('register', handler),
    };
  },
});
