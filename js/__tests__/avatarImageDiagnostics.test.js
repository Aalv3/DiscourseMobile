import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  avatarImageDiagnosticKey,
  avatarImageDiagnosticLimit,
  avatarRouteClass,
  avatarSourceClass,
  recordAvatarImageDiagnostic,
  sanitizedAvatarImageError,
} from '../avatarImageDiagnostics';

describe('avatar image diagnostics', () => {
  beforeEach(() => {
    AsyncStorage.getItem.mockReset();
    AsyncStorage.setItem.mockReset();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
  });

  test('classifies sources without retaining identity-bearing routes', () => {
    expect(
      avatarSourceClass('/user_avatar/internal/member/{size}/14_2.png'),
    ).toBe('custom_remote');
    expect(
      avatarRouteClass('/user_avatar/internal/member/{size}/14_2.png'),
    ).toBe('user_avatar_route');
    expect(avatarSourceClass(null)).toBe('initials');
    expect(avatarRouteClass(null)).toBe('none');
  });

  test('sanitizes native image errors', () => {
    expect(
      sanitizedAvatarImageError({
        nativeEvent: {
          error:
            'Unable to decode https://staging.example/user_avatar/private.png',
        },
      }),
    ).toEqual({ category: 'decode', message: 'decode_failed' });
  });

  test('persists only bounded privacy-safe lifecycle fields', async () => {
    recordAvatarImageDiagnostic({
      event: 'onError',
      consumer: 'edit_profile',
      mountId: 'avatar-safe-1',
      authorityVersion: 7,
      sourceClass: 'custom_remote',
      routeClass: 'user_avatar_route',
      width: 120,
      height: 120,
      category: 'network',
      message: 'network_failed',
      url: 'https://should-not-be-stored.example/member',
      username: 'should-not-be-stored',
    });
    await new Promise(resolve => setImmediate(resolve));

    const [key, value] = AsyncStorage.setItem.mock.calls.at(-1);
    expect(key).toBe(avatarImageDiagnosticKey);
    expect(value).not.toContain('should-not-be-stored');
    expect(JSON.parse(value)).toEqual([
      expect.objectContaining({
        event: 'onError',
        category: 'network',
        message: 'network_failed',
      }),
    ]);
    expect(avatarImageDiagnosticLimit).toBeLessThanOrEqual(200);
  });

  test('all three consumers expose load, error and source-change diagnostics', () => {
    const fs = require('fs');
    const path = require('path');
    const read = file =>
      fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const profile = read('product/NativeProfileScreen.js');
    const you = read('product/ProductScreens.js');
    const diagnostics = read('avatarImageDiagnostics.js');

    expect(profile).toContain("consumer: 'member_profile'");
    expect(profile).toContain("consumer: 'edit_profile'");
    expect(you).toContain("consumer: 'you_summary'");
    ['onLoadStart', 'onLoad', 'onError', 'onLoadEnd', 'source_changed'].forEach(
      event => expect(diagnostics).toContain(`event: '${event}'`),
    );
    expect(diagnostics).toContain('fallbackReplacesRemote: false');
    expect(diagnostics).not.toContain('entry.url');
    expect(diagnostics).not.toContain('entry.username');
  });
});
