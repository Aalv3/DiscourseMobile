import fs from 'fs';
import path from 'path';

const mockListeners = {};

jest.mock('@react-native-community/push-notification-ios', () => ({
  addEventListener: jest.fn((name, handler) => {
    mockListeners[name] = handler;
  }),
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
    consumeAPNSRegistrationFailure: jest.fn(() => Promise.resolve(false)),
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

  test('consumes an early native APNs failure before registering again', async () => {
    const { native, transport } = loadTransport('authorized');
    native.consumeAPNSToken.mockResolvedValue(null);
    native.consumeAPNSRegistrationFailure.mockResolvedValue(true);
    await expect(transport.token()).rejects.toThrow('push_token_failed');
    expect(native.registerForRemoteNotifications).not.toHaveBeenCalled();
  });

  test('bounds an APNs token event that never arrives and ignores a late event', async () => {
    jest.useFakeTimers();
    const { native, transport } = loadTransport('authorized');
    native.consumeAPNSToken.mockResolvedValue(null);
    const pending = transport.token();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(15000);
    await expect(pending).rejects.toThrow('push_token_timeout');
    expect(() => mockListeners.register('late-token')).not.toThrow();
    jest.useRealTimers();
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
    const appDelegateSource = fs.readFileSync(
      path.join(__dirname, '../../ios/Discourse/AppDelegate.swift'),
      'utf8',
    );
    expect(nativeSource).toContain(
      'getNotificationSettingsWithCompletionHandler',
    );
    expect(nativeSource).toContain('requestAuthorizationWithOptions');
    expect(nativeSource).toContain('registerForRemoteNotifications');
    expect(nativeSource).toContain('consumeAPNSRegistrationFailure');
    expect(appDelegateSource).toContain('storeAPNSRegistrationFailure');
    expect(transportSource).not.toContain('checkPermissions');
    expect(transportSource).not.toContain('requestPermissions');
  });
});
