import {
  nativeContracts,
  parseHomepageIntelligence,
} from '../adjusterNetworkContracts';

describe('Adjuster Network shared native contracts', () => {
  test('maps only destinations backed by a route', () => {
    expect(nativeContracts.destinations.floor.route).toBe('Home');
    expect(nativeContracts.destinations.activity.route).toBe('Notifications');
    expect(nativeContracts.destinations.ask.route).toBeNull();
    expect(nativeContracts.destinations.cat.route).toBeNull();
    expect(nativeContracts.destinations.you.route).toBeNull();
  });

  test('keeps admission and onboarding surfaces counsel gated', () => {
    expect(nativeContracts.future.onboarding).toEqual({
      route: null,
      status: 'counsel_gated',
    });
    expect(nativeContracts.future.requestToJoin).toEqual({
      route: null,
      status: 'counsel_gated',
    });
  });

  test('keeps restrictions server authoritative and fail closed', () => {
    expect(nativeContracts.restrictions).toMatchObject({
      authority: 'server',
      failClosed: true,
    });
  });

  test('accepts the known homepage contract without reshaping it', () => {
    const payload = {
      schema: 'an.home-intelligence.v1',
      generated_at: '2026-08-08T20:00:00Z',
      state: 'ready',
      claims_and_regulatory: { state: 'empty', items: [] },
      claims_weather: { state: 'empty', items: [] },
      network: { state: 'empty', items: [] },
      future_server_field: true,
    };
    expect(parseHomepageIntelligence(payload)).toBe(payload);
  });

  test.each([
    null,
    {},
    {
      schema: 'an.home-intelligence.v2',
      generated_at: '2026-08-08T20:00:00Z',
      state: 'ready',
    },
    {
      schema: 'an.home-intelligence.v1',
      generated_at: '2026-08-08T20:00:00Z',
      state: 'ready',
      claims_and_regulatory: {},
      claims_weather: {},
    },
  ])('fails closed for unsupported or incomplete payload %#', payload => {
    expect(parseHomepageIntelligence(payload)).toMatchObject({
      state: 'unavailable',
    });
  });
});
