import fs from 'fs';
import path from 'path';

jest.mock('@react-native-community/push-notification-ios', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

function loadTransport(nativeState) {
  jest.resetModules();
  const { NativeModules } = require('react-native');
  NativeModules.DiscourseKeyboardShortcuts = {
    notificationAuthorizationState: jest.fn(() => Promise.resolve(nativeState)),
    requestNotificationAuthorization: jest.fn(() =>
      Promise.resolve(nativeState),
    ),
    consumeAPNSToken: jest.fn(() => Promise.resolve('native-token')),
    registerForRemoteNotifications: jest.fn(),
  };
  return {
    native: NativeModules.DiscourseKeyboardShortcuts,
    transport: require('../platforms/push-transport.ios').pushTransport,
  };
}

describe('native iOS push authorization transport', () => {
  test.each(['authorized', 'provisional', 'ephemeral'])(
    '%s proceeds as granted without a permission request',
    async nativeState => {
      const { native, transport } = loadTransport(nativeState);
      await expect(transport.permissionState()).resolves.toBe('granted');
      expect(native.notificationAuthorizationState).toHaveBeenCalledTimes(1);
      expect(native.requestNotificationAuthorization).not.toHaveBeenCalled();
    },
  );

  test.each([
    ['denied', 'denied'],
    ['notDetermined', 'not_determined'],
    ['unexpected', 'unknown'],
  ])('maps native %s to bounded JS state %s', async (nativeState, expected) => {
    const { transport } = loadTransport(nativeState);
    await expect(transport.permissionState()).resolves.toBe(expected);
  });

  test('requests authorization through the native bridge', async () => {
    const { native, transport } = loadTransport('authorized');
    await expect(transport.requestPermission()).resolves.toBe('granted');
    expect(native.requestNotificationAuthorization).toHaveBeenCalledTimes(1);
  });

  test('uses the AppDelegate token buffer before registering again', async () => {
    const { native, transport } = loadTransport('authorized');
    await expect(transport.token()).resolves.toBe('native-token');
    expect(native.consumeAPNSToken).toHaveBeenCalledTimes(1);
    expect(native.registerForRemoteNotifications).not.toHaveBeenCalled();
  });

  test('native implementation uses UserNotifications and no RN permission API', () => {
    const nativeSource = fs.readFileSync(
      path.join(__dirname, '../../ios/DiscourseKeyboardShortcuts.m'),
      'utf8',
    );
    const transportSource = fs.readFileSync(
      path.join(__dirname, '../platforms/push-transport.ios.js'),
      'utf8',
    );
    expect(nativeSource).toContain(
      'getNotificationSettingsWithCompletionHandler',
    );
    expect(nativeSource).toContain('requestAuthorizationWithOptions');
    expect(nativeSource).toContain('registerForRemoteNotifications');
    expect(transportSource).not.toContain('checkPermissions');
    expect(transportSource).not.toContain('requestPermissions');
  });
});
