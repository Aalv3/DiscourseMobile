import Site from '../site';
import fetch from '../../lib/fetch';
import {
  RATE_LIMIT_COOLDOWN_MAX_MS,
  RATE_LIMIT_MAX_MS,
  apiRateLimitCoordinator,
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

describe('the IP-bucket pre-request wait was removed from this package', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'site.js'), 'utf8');

  test('jsonApi waits only on the user-api and endpoint-class buckets', () => {
    expect(source).toContain(
      'await requestOrchestrator.waitForBucket(globalUserBucket)',
    );
    expect(source).toContain(
      'await requestOrchestrator.waitForBucket(fallbackBucket)',
    );
    // Scope kept minimal to the proven User API limiter defect.
    expect(source).not.toContain('ipBucket');
    expect(source).not.toContain("errorCode: 'ip_60_secs_limit'");
  });

  test('the pre-existing IP bucket machinery is preserved', () => {
    expect(
      limiterBucket({
        origin: ORIGIN,
        clientId: 'c',
        path: '/x',
        errorCode: 'ip_60_secs_limit',
      }),
    ).toBe(`${ORIGIN}:ip`);
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

  test('auth, logout and session recovery cannot deadlock', async () => {
    let clock = 0;
    const orchestrator = new requestOrchestrator.constructor({
      now: () => clock,
      sleep: ms => {
        clock += ms;
        return Promise.resolve();
      },
    });
    // A hostile Retry-After is capped at the cooldown ceiling, and no single
    // request waits for it: the waiter fails fast instead of hanging.
    orchestrator.beginCooldown(
      'b',
      limited('999999', 'user_api_key_limiter_60_secs'),
      0,
    );
    expect(orchestrator.cooldowns.get('b')).toBe(RATE_LIMIT_COOLDOWN_MAX_MS);
    await expect(orchestrator.waitForBucket('b')).rejects.toMatchObject({
      message: 'api_rate_limited',
      status: 429,
    });
    // Nothing slept, so no caller can be held.
    expect(clock).toBe(0);
    // The cooldown is preserved for later requests rather than cleared.
    expect(orchestrator.cooldowns.get('b')).toBe(RATE_LIMIT_COOLDOWN_MAX_MS);
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

describe('Q6: cooldown lifetime vs per-request ceiling', () => {
  const makeOrchestrator = () => {
    const state = { clock: 0 };
    const orchestrator = new requestOrchestrator.constructor({
      now: () => state.clock,
      sleep: ms => {
        state.clock += ms;
        return Promise.resolve();
      },
    });
    return { orchestrator, state };
  };

  test('the two ceilings are distinct', () => {
    expect(RATE_LIMIT_MAX_MS).toBe(60000);
    expect(RATE_LIMIT_COOLDOWN_MAX_MS).toBe(180000);
  });

  test.each([
    ['30', 30000, 'waits'],
    ['60', 60000, 'waits'],
    ['136', 136000, 'fails fast'],
    ['300', RATE_LIMIT_COOLDOWN_MAX_MS, 'fails fast'],
  ])(
    'Retry-After %s records a %s ms cooldown and then %s',
    async (header, expected) => {
      const { orchestrator, state } = makeOrchestrator();
      const delay = orchestrator.beginCooldown(
        'b',
        limited(header, 'user_api_key_limiter_60_secs'),
        0,
      );
      expect(delay).toBe(expected);
      expect(orchestrator.cooldowns.get('b')).toBe(expected);

      if (expected > RATE_LIMIT_MAX_MS) {
        await expect(orchestrator.waitForBucket('b')).rejects.toMatchObject({
          status: 429,
        });
        expect(state.clock).toBe(0);
      } else {
        await orchestrator.waitForBucket('b');
        expect(state.clock).toBeGreaterThanOrEqual(expected);
        expect(orchestrator.cooldowns.has('b')).toBe(false);
      }
    },
  );

  test('no request is sent inside an active 136s cooldown', async () => {
    jest.useFakeTimers();
    requestOrchestrator.beginCooldown(
      `${ORIGIN}:user-api:client-A`,
      limited('136', 'user_api_key_limiter_60_secs'),
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
    await expect(site.jsonApi('/latest.json')).rejects.toMatchObject({
      message: 'api_rate_limited',
      status: 429,
    });
    // Fail fast: nothing reached the network inside the window.
    expect(fetch).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('later requests keep observing the cooldown until it truly expires', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.beginCooldown(
      'b',
      limited('136', 'user_api_key_limiter_60_secs'),
      0,
    );
    await expect(orchestrator.waitForBucket('b')).rejects.toMatchObject({
      status: 429,
    });
    // Still active after the per-request ceiling would have elapsed.
    orchestrator.now = () => 61000;
    await expect(orchestrator.waitForBucket('b')).rejects.toMatchObject({
      status: 429,
    });
    // Inside the final minute it becomes a normal bounded wait again.
    orchestrator.now = () => 100000;
    await orchestrator.waitForBucket('b');
  });

  test('normal requests resume after the cooldown expires', async () => {
    jest.useFakeTimers();
    requestOrchestrator.beginCooldown(
      `${ORIGIN}:user-api:client-A`,
      limited('30', 'user_api_key_limiter_60_secs'),
      0,
    );
    fetch.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ ok: 3 }),
    });
    const site = new Site({
      url: ORIGIN,
      authToken: 'k',
      clientId: 'client-A',
    });
    const pending = site.jsonApi('/latest.json');
    await jest.advanceTimersByTimeAsync(0);
    expect(fetch).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(31000);
    await expect(pending).resolves.toEqual({ ok: 3 });
    expect(fetch).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('a repeated 429 extends the cooldown without fan-out', async () => {
    const { orchestrator } = makeOrchestrator();
    orchestrator.beginCooldown(
      'b',
      limited('30', 'user_api_key_limiter_60_secs'),
      0,
    );
    expect(orchestrator.cooldowns.get('b')).toBe(30000);
    // A longer directive extends it.
    orchestrator.beginCooldown(
      'b',
      limited('136', 'user_api_key_limiter_60_secs'),
      1,
    );
    expect(orchestrator.cooldowns.get('b')).toBe(136000);
    // A shorter directive never shortens it.
    orchestrator.beginCooldown(
      'b',
      limited('5', 'user_api_key_limiter_60_secs'),
      2,
    );
    expect(orchestrator.cooldowns.get('b')).toBe(136000);
    // One shared window, not one per caller.
    expect(orchestrator.cooldowns.size).toBe(1);
  });

  test('GET retry count stays bounded when the window is short', async () => {
    jest.useFakeTimers();
    fetch.mockResolvedValue(limited('2', 'user_api_key_limiter_60_secs'));
    const site = new Site({
      url: ORIGIN,
      authToken: 'k',
      clientId: 'client-A',
    });
    const rejection = expect(
      site.jsonApi('/latest.json'),
    ).rejects.toMatchObject({ status: 429 });
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(60000);
    await rejection;
    expect(fetch).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});
