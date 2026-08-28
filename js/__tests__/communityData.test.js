/* @flow */
'use strict';

import {
  classifyCommunityLoadError,
  communityRequestCanRetry,
  loadCommunity,
  loadCommunityResource,
} from '../product/ProductData';

describe('community startup recovery', () => {
  test('classifies Floor rate limiting separately from connectivity', () => {
    expect(
      classifyCommunityLoadError({ message: 'api_rate_limited', status: 429 }),
    ).toBe('rate_limited');
    expect(classifyCommunityLoadError(new TypeError('offline'))).toBe(
      'unavailable',
    );
  });

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
    expect(communityRequestCanRetry({ status: 429 })).toBe(false);
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

  test('coalesces sibling tab refreshes without retaining a stale snapshot', async () => {
    let releaseLatest;
    const firstLatest = new Promise(resolve => (releaseLatest = resolve));
    const site = {
      jsonApi: jest.fn(path =>
        path === '/latest.json'
          ? firstLatest
          : Promise.resolve({ categories: [{ id: 2 }] }),
      ),
    };

    const floor = loadCommunity(site);
    const discussions = loadCommunity(site);
    const ask = loadCommunity(site);
    expect(site.jsonApi).toHaveBeenCalledTimes(2);
    releaseLatest({ topic_list: { topics: [{ id: 1 }] } });
    await expect(Promise.all([floor, discussions, ask])).resolves.toEqual([
      { topics: [{ id: 1 }], categories: [{ id: 2 }] },
      { topics: [{ id: 1 }], categories: [{ id: 2 }] },
      { topics: [{ id: 1 }], categories: [{ id: 2 }] },
    ]);

    site.jsonApi.mockImplementation(path =>
      Promise.resolve(
        path === '/latest.json'
          ? { topic_list: { topics: [{ id: 3 }] } }
          : { categories: [{ id: 2 }] },
      ),
    );
    await expect(loadCommunity(site)).resolves.toEqual({
      topics: [{ id: 3 }],
      categories: [{ id: 2 }],
    });
    expect(site.jsonApi).toHaveBeenCalledTimes(4);
  });

  test('Ask confirmation invalidates shared Floor and Discussions content', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'product', 'ProductScreens.js'),
      'utf8',
    );
    const ask = source.slice(
      source.indexOf('export function AskScreen'),
      source.indexOf('export function IntelligenceScreen'),
    );
    expect(ask).not.toContain('data.refresh();');
    expect(
      ask.match(/screenProps\.invalidateMemberContent\(\);/g),
    ).toHaveLength(2);
    expect(
      ask.indexOf('screenProps.invalidateMemberContent();'),
    ).toBeGreaterThan(ask.indexOf('attachmentQueue.clear();'));
  });
});
