import Site from '../site';
import fetch from '../../lib/fetch';
import { apiRateLimitCoordinator } from '../apiRateLimit';
import { requestOrchestrator } from '../requestOrchestrator';

jest.mock('../../lib/fetch', () => jest.fn());

describe('site privacy serialization', () => {
  beforeEach(() => {
    fetch.mockReset();
    apiRateLimitCoordinator.reset();
    requestOrchestrator.reset();
  });

  test('never serializes the user API key into AsyncStorage metadata', () => {
    const site = new Site({
      url: 'https://adjusternetwork.org',
      authToken: 'synthetic-secret',
      username: 'synthetic-user',
    });
    expect(site.toJSON()).not.toHaveProperty('authToken');
    expect(JSON.stringify(site)).not.toContain('synthetic-secret');
  });

  test('persists the non-secret User API client identifier', () => {
    const site = new Site({
      url: 'https://adjusternetwork.org',
      clientId: 'synthetic-client-id',
    });

    expect(site.toJSON()).toHaveProperty('clientId', 'synthetic-client-id');
  });

  test('relaunch and logout/login preserve the authorization-bound client ID', () => {
    const original = new Site({
      url: 'https://adjusternetwork.org',
      authToken: 'first-key',
      clientId: 'auth-client-A',
    });
    const relaunched = new Site(original.toJSON());

    expect(relaunched.clientId).toBe('auth-client-A');
    relaunched.logoff();
    relaunched.authToken = 'second-key';
    expect(relaunched.clientId).toBe('auth-client-A');
  });

  test('first authenticated request sends the authorization-bound client ID', async () => {
    fetch.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });
    const site = new Site({
      url: 'https://adjusternetwork.org',
      authToken: 'synthetic-key',
      clientId: 'auth-client-A',
    });

    await expect(site.jsonApi('/session/current.json')).resolves.toEqual({
      ok: true,
    });
    expect(fetch.mock.calls[0][0].headers.get('User-Api-Client-Id')).toBe(
      'auth-client-A',
    );
  });

  test('waits for Retry-After and succeeds on one bounded retry', async () => {
    jest.useFakeTimers();
    fetch
      .mockResolvedValueOnce({
        status: 429,
        headers: { get: name => (name === 'Retry-After' ? '3' : null) },
      })
      .mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });
    const site = new Site({
      url: 'https://staging.adjusternetwork.org',
      authToken: 'synthetic-key',
    });
    const pending = site.jsonApi('/latest.json');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
    await jest.runOnlyPendingTimersAsync();
    await expect(pending).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  test('admits unrelated unknown limiter classes independently', async () => {
    jest.useFakeTimers();
    const limited = {
      status: 429,
      headers: { get: () => null },
    };
    fetch
      .mockResolvedValueOnce(limited)
      .mockResolvedValueOnce(limited)
      .mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ topics: true }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ notifications: true }),
      });
    const site = new Site({
      url: 'https://staging.adjusternetwork.org',
      authToken: 'synthetic-key',
    });
    const floor = site.jsonApi('/latest.json');
    const notifications = site.jsonApi('/notifications.json');
    await Promise.resolve();
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(2);
    await jest.runOnlyPendingTimersAsync();
    await expect(Promise.all([floor, notifications])).resolves.toEqual([
      { topics: true },
      { notifications: true },
    ]);
    expect(fetch).toHaveBeenCalledTimes(4);
    jest.useRealTimers();
  });

  test('stops after two rate-limit retries and preserves the 429 category', async () => {
    jest.useFakeTimers();
    fetch.mockResolvedValue({
      status: 429,
      headers: { get: () => null },
    });
    const site = new Site({
      url: 'https://staging.adjusternetwork.org',
      authToken: 'synthetic-key',
    });
    const pending = site.jsonApi('/latest.json');
    const rejection = expect(pending).rejects.toMatchObject({
      message: 'api_rate_limited',
      status: 429,
    });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(5000);
    await rejection;
    expect(fetch).toHaveBeenCalledTimes(3);
    apiRateLimitCoordinator.reset();
    jest.useRealTimers();
  });

  test('accepts successful no-content mutations without parsing JSON', async () => {
    const json = jest.fn();
    fetch.mockResolvedValue({ status: 204, json });
    const site = new Site({
      url: 'https://adjusternetwork.org',
      authToken: 'synthetic-key',
      clientId: 'auth-client-A',
    });

    await expect(site.jsonApi('/posts/42.json', 'DELETE')).resolves.toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  test('multipart uploads preserve User API identity without forcing a boundary', async () => {
    fetch.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ id: 42 }),
    });
    const site = new Site({
      url: 'https://adjusternetwork.org',
      authToken: 'synthetic-key',
      clientId: 'auth-client-A',
    });
    const body = new FormData();
    body.append('type', 'avatar');

    await expect(site.multipartApi('/uploads.json', body)).resolves.toEqual({
      id: 42,
    });
    const request = fetch.mock.calls.at(-1)[0];
    expect(request.headers.get('User-Api-Key')).toBe('synthetic-key');
    expect(request.headers.get('User-Api-Client-Id')).toBe('auth-client-A');
    expect(request.headers.get('Content-Type')).not.toBe('application/json');
  });

  test('does not require a JSON body for successful deletes', async () => {
    const json = jest.fn(() => Promise.reject(new SyntaxError('empty body')));
    fetch.mockResolvedValue({ status: 200, json });
    const site = new Site({
      url: 'https://adjusternetwork.org',
      authToken: 'synthetic-key',
      clientId: 'auth-client-A',
    });

    await expect(site.jsonApi('/posts/42.json', 'DELETE')).resolves.toBeNull();
    expect(json).not.toHaveBeenCalled();
  });
});
