/* @flow */
'use strict';

import { limiterBucket, RequestOrchestrator } from '../requestOrchestrator';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('authenticated request orchestrator', () => {
  test('coalesces stable keys and caches successful snapshots', async () => {
    const orchestrator = new RequestOrchestrator();
    const gate = deferred();
    const task = jest.fn(() => gate.promise);
    const first = orchestrator.request({
      key: 'site:user:GET:/floor',
      task,
      ttlMs: 1000,
    });
    const second = orchestrator.request({
      key: 'site:user:GET:/floor',
      task,
      ttlMs: 1000,
    });
    expect(task).toHaveBeenCalledTimes(1);
    gate.resolve({ value: 1 });
    await expect(first).resolves.toEqual({ value: 1 });
    await expect(second).resolves.toEqual({ value: 1 });
    await expect(
      orchestrator.request({ key: 'site:user:GET:/floor', task, ttlMs: 1000 }),
    ).resolves.toEqual({ value: 1 });
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('never exceeds three active requests', async () => {
    const orchestrator = new RequestOrchestrator();
    const gates = Array.from({ length: 5 }, deferred);
    let active = 0;
    let maximum = 0;
    const requests = gates.map((gate, index) =>
      orchestrator.request({
        key: `request-${index}`,
        task: async () => {
          active += 1;
          maximum = Math.max(maximum, active);
          await gate.promise;
          active -= 1;
          return index;
        },
      }),
    );
    expect(maximum).toBe(3);
    gates.slice(0, 3).forEach(gate => gate.resolve());
    await Promise.resolve();
    await Promise.resolve();
    gates.slice(3).forEach(gate => gate.resolve());
    await Promise.all(requests);
    expect(maximum).toBe(3);
  });

  test('an endpoint limiter does not block an unrelated family', async () => {
    let now = 0;
    const sleeps = [];
    const orchestrator = new RequestOrchestrator({
      now: () => now,
      sleep: ms => {
        sleeps.push(ms);
        now += ms;
        return Promise.resolve();
      },
    });
    const photo = limiterBucket({
      origin: 'https://staging',
      path: '/native/v1/profile/photo',
      errorCode: 'an_profile_photo_upload',
    });
    const notifications = limiterBucket({
      origin: 'https://staging',
      path: '/native/v1/notifications',
      errorCode: null,
    });
    orchestrator.cooldowns.set(photo, 30000);
    await orchestrator.waitForBucket(notifications);
    expect(sleeps).toEqual([]);
    await orchestrator.waitForBucket(photo);
    expect(sleeps[0]).toBe(30000);
  });

  test('global User API limiter shares one client-identity bucket', () => {
    const input = {
      origin: 'https://staging',
      clientId: 'mobile',
      path: '/native/v1/profile',
    };
    expect(
      limiterBucket({ ...input, errorCode: 'user_api_key_limiter_60_secs' }),
    ).toBe(
      limiterBucket({
        ...input,
        path: '/native/v1/notifications',
        errorCode: 'user_api_key_limiter_60_secs',
      }),
    );
  });
});
