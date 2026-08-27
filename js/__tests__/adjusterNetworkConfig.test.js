import {
  adjusterNetwork,
  canonicalOriginForChannel,
  trustedPushEnvironment,
  trustedUpdateChannel,
} from '../adjusterNetworkConfig';

describe('Adjuster Network product boundary', () => {
  test('pins the canonical HTTPS origin', () => {
    expect(adjusterNetwork.canonicalOrigin).toBe('https://adjusternetwork.org');
    expect(canonicalOriginForChannel('staging')).toBe(
      'https://staging.adjusternetwork.org',
    );
    expect(canonicalOriginForChannel('production')).toBe(
      'https://adjusternetwork.org',
    );
    expect(canonicalOriginForChannel(null)).toBeNull();
    expect(canonicalOriginForChannel('unknown')).toBeNull();
    expect(trustedUpdateChannel('staging')).toBe('staging');
    expect(trustedUpdateChannel('production')).toBe('production');
    expect(trustedUpdateChannel('preview')).toBeNull();
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
  });
});

describe('push backend channel routing', () => {
  const backendOriginForUpdatesChannel = channel => {
    jest.resetModules();
    jest.doMock('expo-updates', () => ({ channel }));
    return require('../adjusterNetworkConfig').adjusterNetwork.push
      .backendOrigin;
  };

  afterEach(() => {
    jest.dontMock('expo-updates');
    jest.resetModules();
  });

  test('routes staging registration only to staging Discourse', () => {
    expect(backendOriginForUpdatesChannel('staging')).toBe(
      'https://staging.adjusternetwork.org',
    );
  });

  test('routes production registration only to production Discourse', () => {
    expect(backendOriginForUpdatesChannel('production')).toBe(
      'https://adjusternetwork.org',
    );
  });

  test('fails closed for an unknown update channel', () => {
    expect(backendOriginForUpdatesChannel('preview')).toBeNull();
    expect(backendOriginForUpdatesChannel(undefined)).toBeNull();
  });
});
