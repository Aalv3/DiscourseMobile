import {
  adjusterNetwork,
  trustedAPSEnvironment,
  trustedPushEnvironment,
} from '../adjusterNetworkConfig';

describe('Adjuster Network product boundary', () => {
  test('pins the canonical HTTPS origin', () => {
    expect(adjusterNetwork.canonicalOrigin).toBe('https://adjusternetwork.org');
  });

  test('exposes only routes backed by the current application', () => {
    expect(adjusterNetwork.navigation.floor).toMatchObject({
      route: 'Home',
      available: true,
    });
    expect(adjusterNetwork.navigation.activity).toMatchObject({
      route: 'Notifications',
      available: true,
    });
    for (const key of ['ask', 'cat', 'you']) {
      expect(adjusterNetwork.navigation[key]).toMatchObject({
        route: null,
        available: false,
      });
    }
  });

  test('keeps telemetry and the legacy relay disabled while enabling dark registration', () => {
    expect(adjusterNetwork.features).toMatchObject({
      analytics: false,
      crashReporting: false,
      push: false,
      pushEducation: true,
      pushDelivery: true,
      publicNativePreview: false,
    });
    expect(adjusterNetwork.push.backendOrigin).toBe(
      'https://adjusternetwork.org',
    );
    expect([null, 'staging', 'production']).toContain(
      adjusterNetwork.push.environment,
    );
  });

  test('accepts only trusted iOS build environments', () => {
    expect(trustedPushEnvironment('ios', 'staging')).toBe('staging');
    expect(trustedPushEnvironment('ios', 'production')).toBe('production');
    expect(trustedPushEnvironment('ios', 'sandbox')).toBeNull();
    expect(trustedPushEnvironment('android', 'production')).toBeNull();
    expect(trustedAPSEnvironment('ios', 'development')).toBe('development');
    expect(trustedAPSEnvironment('ios', 'production')).toBe('production');
    expect(trustedAPSEnvironment('ios', 'sandbox')).toBeNull();
  });
});
