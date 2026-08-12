/* @flow */
'use strict';

import PushNotificationIOS from '@react-native-community/push-notification-ios';

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
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('push_token_timeout')),
        15000,
      );
      const handler = token => {
        clearTimeout(timeout);
        PushNotificationIOS.removeEventListener('register', handler);
        resolve(token);
      };
      PushNotificationIOS.addEventListener('register', handler);
      PushNotificationIOS.registerForRemoteNotifications();
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
