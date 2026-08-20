/* @flow */
'use strict';

import {
  communityRequestCanRetry,
  loadCommunity,
  loadCommunityResource,
} from '../product/ProductData';

describe('community startup recovery', () => {
  test('retries one transient network failure and then succeeds', async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ ok: true });
    const delay = jest.fn().mockResolvedValue(undefined);
    await expect(loadCommunityResource(request, delay)).resolves.toEqual({
      ok: true,
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
  });

  test('stops after two bounded transient retries', async () => {
    const failure = new TypeError('Network request failed');
    const request = jest.fn().mockRejectedValue(failure);
    const delay = jest.fn().mockResolvedValue(undefined);
    await expect(loadCommunityResource(request, delay)).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenNthCalledWith(1, 650);
    expect(delay).toHaveBeenNthCalledWith(2, 1800);
  });

  test('does not retry authorization or not-found responses', async () => {
    expect(communityRequestCanRetry({ status: 403 })).toBe(false);
    expect(communityRequestCanRetry({ status: 404 })).toBe(false);
    expect(communityRequestCanRetry({ status: 429 })).toBe(true);
    expect(communityRequestCanRetry({ status: 503 })).toBe(true);
    const denied = Object.assign(new Error('forbidden'), { status: 403 });
    const request = jest.fn().mockRejectedValue(denied);
    await expect(loadCommunityResource(request, jest.fn())).rejects.toBe(
      denied,
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('loads latest topics and categories after independent bounded recovery', async () => {
    const calls = { latest: 0, site: 0 };
    const site = {
      jsonApi: jest.fn(path => {
        if (path === '/latest.json') {
          calls.latest += 1;
          return calls.latest === 1
            ? Promise.reject(new TypeError('startup network race'))
            : Promise.resolve({ topic_list: { topics: [{ id: 1 }] } });
        }
        calls.site += 1;
        return Promise.resolve({ categories: [{ id: 2 }] });
      }),
    };
    jest.useFakeTimers();
    const pending = loadCommunity(site);
    await jest.runAllTimersAsync();
    await expect(pending).resolves.toEqual({
      topics: [{ id: 1 }],
      categories: [{ id: 2 }],
    });
    jest.useRealTimers();
  });
});
