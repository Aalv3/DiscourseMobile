import { adjusterNetwork } from '../adjusterNetworkConfig';

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

  test('keeps unapproved telemetry and push disabled', () => {
    expect(adjusterNetwork.features).toMatchObject({
      analytics: false,
      crashReporting: false,
      push: false,
      pushEducation: false,
      pushDelivery: false,
      publicNativePreview: false,
    });
  });
});
