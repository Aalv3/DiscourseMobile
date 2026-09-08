import Site from '../site';
import fetch from '../../lib/fetch';
import {
  RATE_LIMIT_MAX_MS,
  apiRateLimitCoordinator,
  rateLimitDelayMs,
} from '../apiRateLimit';
import { limiterBucket, requestOrchestrator } from '../requestOrchestrator';

jest.mock('../../lib/fetch', () => jest.fn());

const ORIGIN = 'https://adjusternetwork.org';
const bucketFor = (errorCode, path = '/latest.json', clientId = 'client-A') =>
  limiterBucket({ origin: ORIGIN, clientId, path, errorCode });

const limited = (retryAfter, code) => ({
  status: 429,
  headers: {
    get: name =>
      name === 'Retry-After'
        ? retryAfter
        : name === 'Discourse-Rate-Limit-Error-Code'
        ? code
        : null,
  },
});

beforeEach(() => {
  fetch.mockReset();
  apiRateLimitCoordinator.reset();
  requestOrchestrator.reset();
});

describe('Q1: which bucket a user-api 429 enters', () => {
  test('user_api_key_limiter_60_secs keys on origin + User API client id', () => {
    expect(bucketFor('user_api_key_limiter_60_secs')).toBe(
      `${ORIGIN}:user-api:client-A`,
    );
    // The daily limiter shares that bucket, matching the server keying.
    expect(bucketFor('user_api_key_limiter_1_day')).toBe(
      `${ORIGIN}:user-api:client-A`,
    );
    // A different key is a different bucket: one member cannot stall another.
    expect(
      bucketFor('user_api_key_limiter_60_secs', '/latest.json', 'client-B'),
    ).toBe(`${ORIGIN}:user-api:client-B`);
  });

  test('the user-api bucket is path independent', () => {
    for (const path of [
      '/native/v1/profile',
      '/u/tomrodriguez.json',
      '/chat/api/me/channels.json',
      '/site.json',
      '/latest.json',
    ]) {
      expect(bucketFor('user_api_key_limiter_60_secs', path)).toBe(
        `${ORIGIN}:user-api:client-A`,
      );
    }
  });
});

describe('Q2: which later paths a user-api cooldown blocks', () => {
  test.each([
    '/native/v1/profile',
    '/u/tomrodriguez.json',
    '/chat/api/me/channels.json',
    '/site.json',
    '/latest.json',
  ])('%s waits on the shared user-api cooldown', async path => {
    jest.useFakeTimers();
    // Seed a live cooldown on the user-api bucket for this client.
    requestOrchestrator.beginCooldown(
      `${ORIGIN}:user-api:client-A`,
      limited('30', 'user_api_key_limiter_60_secs'),
      0,
    );
    fetch.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ ok: 1 }),
    });
    const site = new Site({
      url: ORIGIN,
      authToken: 'k',
      clientId: 'client-A',
    });

    const pending = site.jsonApi(path);
    await jest.advanceTimersByTimeAsync(0);
    // Blocked: no request issued inside the window.
    expect(fetch).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(31000);
    await expect(pending).resolves.toEqual({ ok: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});

describe('Q3/Q4: IP bucket is literal and separate from user-api', () => {
  test('the IP codes map to their own bucket, not a general label', () => {
    expect(bucketFor('ip_10_secs_limit')).toBe(`${ORIGIN}:ip`);
    expect(bucketFor('ip_60_secs_limit')).toBe(`${ORIGIN}:ip`);
    // It is client-id independent, which is what an IP limiter means.
    expect(bucketFor('ip_60_secs_limit', '/latest.json', 'client-B')).toBe(
      `${ORIGIN}:ip`,
    );
  });

  test('user-api and IP cooldowns are separate and do not leak into each other', async () => {
    jest.useFakeTimers();
    requestOrchestrator.beginCooldown(
      `${ORIGIN}:ip`,
      limited('30', 'ip_60_secs_limit'),
      0,
    );
    // The user-api bucket is untouched by an IP cooldown.
    expect(
      requestOrchestrator.cooldowns.has(`${ORIGIN}:user-api:client-A`),
    ).toBe(false);
    expect(requestOrchestrator.cooldowns.has(`${ORIGIN}:ip`)).toBe(true);
    jest.useRealTimers();
  });

  test('native and endpoint-class buckets are also distinct', () => {
    expect(bucketFor('an_admission_required')).toBe(
      `${ORIGIN}:native:an_admission_required`,
    );
    expect(bucketFor(null, '/native/v1/profile')).toBe(
      `${ORIGIN}:class:profile`,
    );
    expect(bucketFor(null, '/chat/api/me/channels.json')).toBe(
      `${ORIGIN}:class:/chat/api`,
    );
  });
});

describe('Q5: correctness of the wait', () => {
  test('the wait expires and the bucket is cleared', async () => {
    let clock = 0;
    const orchestrator = new requestOrchestrator.constructor({
      now: () => clock,
      sleep: ms => {
        clock += ms;
        return Promise.resolve();
      },
    });
    orchestrator.beginCooldown(
      'b',
      limited('30', 'user_api_key_limiter_60_secs'),
      0,
    );
    expect(orchestrator.cooldowns.get('b')).toBe(30000);
    await orchestrator.waitForBucket('b');
    expect(orchestrator.cooldowns.has('b')).toBe(false);
  });

  test('a different client id is not blocked: unrelated traffic proceeds', async () => {
    jest.useFakeTimers();
    requestOrchestrator.beginCooldown(
      `${ORIGIN}:user-api:client-A`,
      limited('30', 'user_api_key_limiter_60_secs'),
      0,
    );
    fetch.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ ok: 2 }),
    });
    // Signed out: clientId absent, so the bucket is :user-api:unknown.
    const other = new Site({ url: ORIGIN });
    const pending = other.jsonApi('/site.json');
    await jest.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(pending).resolves.toEqual({ ok: 2 });
    jest.useRealTimers();
  });

  test('auth, logout and session recovery cannot deadlock: every wait is bounded', async () => {
    let clock = 0;
    const orchestrator = new requestOrchestrator.constructor({
      now: () => clock,
      sleep: ms => {
        clock += ms;
        return Promise.resolve();
      },
    });
    // Even a hostile Retry-After cannot hold a request longer than the clamp.
    orchestrator.beginCooldown(
      'b',
      limited('999999', 'user_api_key_limiter_60_secs'),
      0,
    );
    expect(orchestrator.cooldowns.get('b')).toBe(RATE_LIMIT_MAX_MS);
    await orchestrator.waitForBucket('b');
    expect(clock).toBeLessThanOrEqual(RATE_LIMIT_MAX_MS + 1000);
    expect(orchestrator.cooldowns.has('b')).toBe(false);
  });

  test('a rate-limited mutation is never replayed automatically', async () => {
    jest.useFakeTimers();
    fetch.mockResolvedValue(limited('30', 'user_api_key_limiter_60_secs'));
    const site = new Site({
      url: ORIGIN,
      authToken: 'k',
      clientId: 'client-A',
    });
    const rejection = expect(
      site.jsonApi('/native/v1/profile', 'PATCH', { a: 1 }),
    ).rejects.toMatchObject({
      status: 429,
    });
    await jest.advanceTimersByTimeAsync(0);
    await rejection;
    // One attempt only: writes are not retried after a limiter response.
    expect(fetch).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});

describe('Q6: the 60s clamp against production values up to 136s', () => {
  test('Retry-After above the clamp is truncated to 60s', () => {
    expect(
      rateLimitDelayMs(limited('136', 'user_api_key_limiter_60_secs'), 0),
    ).toBe(RATE_LIMIT_MAX_MS);
    expect(RATE_LIMIT_MAX_MS).toBe(60000);
  });

  test('truncation under-waits, so a 136s directive costs bounded extra 429s', async () => {
    jest.useFakeTimers();
    // Server keeps limiting for longer than the clamp.
    fetch.mockResolvedValue(limited('136', 'user_api_key_limiter_60_secs'));
    const site = new Site({
      url: ORIGIN,
      authToken: 'k',
      clientId: 'client-A',
    });
    const rejection = expect(
      site.jsonApi('/latest.json'),
    ).rejects.toMatchObject({
      status: 429,
    });
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(400000);
    await rejection;
    // Bounded: initial attempt plus RATE_LIMIT_MAX_RETRIES, never a storm.
    expect(fetch).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});
