/* @flow */
'use strict';

import { NativeModules } from 'react-native';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

const { DiscourseKeyboardShortcuts } = NativeModules;

let currentToken = null;
let tokenWaiters = [];

// requestPermissions may cause iOS to register immediately. Observe that
// callback from module load so the one-time token cannot race the later
// backend-registration step. The token remains memory-only.
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
  return new Promise(resolve => {
    PushNotificationIOS.checkPermissions(value =>
      resolve(value.alert ? 'granted' : 'denied'),
    );
  });
}

export const pushTransport = Object.freeze({
  platform: 'ios',
  permissionState,
  async requestPermission() {
    const value = await PushNotificationIOS.requestPermissions({
      alert: true,
      badge: true,
      sound: true,
    });
    return value.alert ? 'granted' : 'denied';
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
        }, 15000);
        tokenWaiters.push(waiter);
        PushNotificationIOS.registerForRemoteNotifications();
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
