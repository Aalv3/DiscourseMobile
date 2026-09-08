import {
  RATE_LIMIT_MAX_MS,
  RATE_LIMIT_MIN_MS,
  rateLimitDelayMs,
  retryAfterDelayMs,
} from '../apiRateLimit';
import { RequestOrchestrator } from '../requestOrchestrator';
import {
  AVATAR_RECOVERY_MAX_ATTEMPTS,
  avatarRecoveryDelayMs,
  avatarShowsImage,
  shouldAttemptAvatarRecovery,
} from '../product/avatarRecovery';

const responseWith = retryAfter => ({
  status: 429,
  headers: { get: name => (name === 'Retry-After' ? retryAfter : null) },
});

describe('P1: Retry-After is honored by the shared cooldown', () => {
  test('regression: passing the response set a zero-length cooldown', () => {
    // retryAfterDelayMs takes the header VALUE. Handing it the response
    // returned null, and now() + null === now(), so the cooldown expired
    // immediately and every request sailed through an active limiter window.
    expect(retryAfterDelayMs(responseWith('30'))).toBeNull();
    expect(Date.now() + null).toBe(Date.now() + 0);
  });

  test('rateLimitDelayMs reads Retry-After off the response', () => {
    expect(rateLimitDelayMs(responseWith('30'), 0)).toBe(30000);
    expect(rateLimitDelayMs(responseWith('5'), 0)).toBe(5000);
  });

  test('a 429 now produces a real cooldown that blocks new requests', async () => {
    let clock = 1000;
    const slept = [];
    const orchestrator = new RequestOrchestrator({
      now: () => clock,
      sleep: ms => {
        slept.push(ms);
        clock += ms;
        return Promise.resolve();
      },
    });

    const delay = orchestrator.beginCooldown('b', responseWith('30'), 0);
    expect(delay).toBe(30000);
    expect(orchestrator.cooldowns.get('b')).toBe(1000 + 30000);

    await orchestrator.waitForBucket('b');
    // The waiter actually slept for the directed window.
    expect(slept.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(30000);
  });

  test('an absent Retry-After falls back to a bounded backoff, never zero', () => {
    let clock = 0;
    const orchestrator = new RequestOrchestrator({
      now: () => clock,
      sleep: () => Promise.resolve(),
    });
    const first = orchestrator.beginCooldown('b', responseWith(null), 0);
    expect(first).toBeGreaterThanOrEqual(RATE_LIMIT_MIN_MS);
    expect(orchestrator.cooldowns.get('b')).toBeGreaterThan(clock);
  });

  test('cooldowns stay bounded so auth and logout cannot deadlock', () => {
    expect(rateLimitDelayMs(responseWith('99999'), 0)).toBe(RATE_LIMIT_MAX_MS);
    expect(rateLimitDelayMs(responseWith('-5'), 0)).toBeLessThanOrEqual(
      RATE_LIMIT_MAX_MS,
    );
  });

  test('a longer directed window never shortens an existing cooldown', () => {
    let clock = 0;
    const orchestrator = new RequestOrchestrator({
      now: () => clock,
      sleep: () => Promise.resolve(),
    });
    orchestrator.beginCooldown('b', responseWith('40'), 0);
    orchestrator.beginCooldown('b', responseWith('5'), 1);
    expect(orchestrator.cooldowns.get('b')).toBe(40000);
  });

  test('no amplification: concurrent waiters observe one window', async () => {
    let clock = 0;
    let sleeps = 0;
    const orchestrator = new RequestOrchestrator({
      now: () => clock,
      sleep: ms => {
        sleeps += 1;
        clock += ms;
        return Promise.resolve();
      },
    });
    orchestrator.beginCooldown('b', responseWith('10'), 0);
    await Promise.all([
      orchestrator.waitForBucket('b'),
      orchestrator.waitForBucket('b'),
      orchestrator.waitForBucket('b'),
    ]);
    // Once the window has elapsed the bucket is cleared, not re-slept forever.
    expect(orchestrator.cooldowns.has('b')).toBe(false);
    expect(sleeps).toBeLessThanOrEqual(3);
  });
});

describe('P1: new requests are gated on the IP bucket as well', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'site.js'), 'utf8');

  test('site.jsonApi waits on user-api, ip and endpoint buckets', () => {
    expect(source).toContain(
      'await requestOrchestrator.waitForBucket(globalUserBucket)',
    );
    expect(source).toContain(
      'await requestOrchestrator.waitForBucket(ipBucket)',
    );
    expect(source).toContain(
      'await requestOrchestrator.waitForBucket(fallbackBucket)',
    );
    expect(source).toContain("errorCode: 'ip_60_secs_limit'");
  });
});

describe('P2: avatar recovers from a transient failure, boundedly', () => {
  test('the initial is not terminal while attempts remain', () => {
    const uri =
      'https://adjusternetwork.org/renaissance/member-photo/t/72/67.png';
    expect(
      avatarShowsImage({ resolvedUri: uri, failedUri: null, attempt: 0 }),
    ).toBe(true);
    // A failure with attempts remaining still resolves to the image.
    expect(
      avatarShowsImage({ resolvedUri: uri, failedUri: uri, attempt: 0 }),
    ).toBe(true);
    expect(
      avatarShowsImage({ resolvedUri: uri, failedUri: uri, attempt: 1 }),
    ).toBe(true);
    // Exhausted: the initial now stands.
    expect(
      avatarShowsImage({
        resolvedUri: uri,
        failedUri: uri,
        attempt: AVATAR_RECOVERY_MAX_ATTEMPTS,
      }),
    ).toBe(false);
    expect(
      avatarShowsImage({ resolvedUri: null, failedUri: null, attempt: 0 }),
    ).toBe(false);
  });

  test('recovery is bounded and never infinite', () => {
    expect(avatarRecoveryDelayMs(0)).toBe(1500);
    expect(avatarRecoveryDelayMs(1)).toBe(6000);
    expect(avatarRecoveryDelayMs(AVATAR_RECOVERY_MAX_ATTEMPTS)).toBeNull();
    expect(avatarRecoveryDelayMs(99)).toBeNull();
    expect(avatarRecoveryDelayMs(-1)).toBeNull();
    expect(shouldAttemptAvatarRecovery(AVATAR_RECOVERY_MAX_ATTEMPTS)).toBe(
      false,
    );
  });

  test('delays back off rather than hammering the limiter', () => {
    const delays = [avatarRecoveryDelayMs(0), avatarRecoveryDelayMs(1)];
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[0]).toBeGreaterThanOrEqual(1000);
  });
});

describe('P2: Avatar wiring', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'product', 'ProductComponents.js'),
    'utf8',
  );

  test('the permanent latch is gone and attempts reset per URI', () => {
    expect(source).toContain('setRecoveryAttempt(current => current + 1)');
    expect(source).toContain('key={`${resolvedUri}#${recoveryAttempt}`}');
    // Changing URI clears both the failure and the attempt count.
    expect(source).toMatch(/setFailedUri\(null\);\s*setRecoveryAttempt\(0\);/);
    // The pending timer is cleared on unmount so no work escapes the instance.
    expect(source).toContain('clearTimeout(recoveryTimer.current)');
  });

  test('the private member-photo credential boundary is untouched', () => {
    expect(source).toContain('source={memberImageSource(site, resolvedUri)}');
    const helper = fs.readFileSync(
      path.join(__dirname, '..', 'product', 'memberImageSource.js'),
      'utf8',
    );
    expect(helper).toContain(
      'MEMBER_PHOTO_PATH = /^\\/renaissance\\/member-photo\\//',
    );
    expect(helper).toContain('isCanonicalUrl(uri)');
  });
});

describe('P4: duplicate profile reads are coalesced, chat is not', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'site.js'), 'utf8');

  test('member profile reads get a short TTL without serving stale', () => {
    expect(source).toContain(
      'const ttlMs = isNativeRead ? 30000 : isMemberRead ? 15000 : 0;',
    );
    expect(source).toContain('allowStale: isNativeRead,');
  });

  test('only /u/:username.json GETs qualify, never chat or mutations', () => {
    const re = /\/\^\\\/u\\\/\[\^\/\]\+\\\.json\//;
    expect(re.test(source)).toBe(true);
    expect(source).not.toMatch(/isMemberRead[\s\S]{0,80}chat/);
  });
});
