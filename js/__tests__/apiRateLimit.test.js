import {
  ApiRateLimitCoordinator,
  RATE_LIMIT_FALLBACK_MS,
  rateLimitDelayMs,
  retryAfterDelayMs,
} from '../apiRateLimit';

describe('shared authenticated API rate-limit cooldown', () => {
  test('honors Retry-After seconds and HTTP dates within the safety bound', () => {
    expect(retryAfterDelayMs('7', 1000)).toBe(7000);
    expect(retryAfterDelayMs(new Date(11000).toUTCString(), 1000)).toBe(10000);
    expect(retryAfterDelayMs('9999', 1000)).toBe(60000);
  });

  test('uses conservative bounded fallback delays without Retry-After', () => {
    const response = { headers: { get: () => null } };
    expect(rateLimitDelayMs(response, 0, 0)).toBe(RATE_LIMIT_FALLBACK_MS[0]);
    expect(rateLimitDelayMs(response, 1, 0)).toBe(RATE_LIMIT_FALLBACK_MS[1]);
  });

  test('concurrent consumers share one cooldown and resume after expiry', async () => {
    let now = 1000;
    const sleepers = [];
    const coordinator = new ApiRateLimitCoordinator({
      now: () => now,
      sleep: ms =>
        new Promise(resolve => {
          sleepers.push({ ms, resolve });
        }),
    });
    const first = coordinator.begin(
      'https://staging.adjusternetwork.org',
      4000,
    );
    const second = coordinator.begin(
      'https://staging.adjusternetwork.org',
      2000,
    );
    expect(second).toBe(first);
    expect(coordinator.wait('https://staging.adjusternetwork.org')).toBe(first);
    expect(sleepers).toHaveLength(1);
    expect(sleepers[0].ms).toBe(4000);

    now = 5000;
    sleepers[0].resolve();
    await first;
    await expect(
      coordinator.wait('https://staging.adjusternetwork.org'),
    ).resolves.toBeUndefined();
  });
});
