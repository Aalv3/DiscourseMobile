/* @flow */
'use strict';

export const RATE_LIMIT_FALLBACK_MS = Object.freeze([2000, 5000]);
export const RATE_LIMIT_MIN_MS = 1000;
export const RATE_LIMIT_MAX_MS = 60000;
export const RATE_LIMIT_MAX_RETRIES = 2;

const boundedDelay = value =>
  Math.min(RATE_LIMIT_MAX_MS, Math.max(RATE_LIMIT_MIN_MS, value));

export function retryAfterDelayMs(value, now = Date.now()) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return boundedDelay(seconds * 1000);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return boundedDelay(Math.max(0, timestamp - now));
}

export function rateLimitDelayMs(response, retryIndex, now = Date.now()) {
  const directed = retryAfterDelayMs(
    response?.headers?.get?.('Retry-After'),
    now,
  );
  return directed ?? RATE_LIMIT_FALLBACK_MS[retryIndex] ?? RATE_LIMIT_MAX_MS;
}

export class ApiRateLimitCoordinator {
  constructor({ now = () => Date.now(), sleep } = {}) {
    this.now = now;
    this.sleep =
      sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.states = new Map();
  }

  wait(origin) {
    return this.states.get(origin)?.promise || Promise.resolve();
  }

  begin(origin, delayMs) {
    const until = this.now() + boundedDelay(delayMs);
    const existing = this.states.get(origin);
    if (existing) {
      existing.until = Math.max(existing.until, until);
      return existing.promise;
    }
    const state = { until, promise: null };
    state.promise = (async () => {
      while (true) {
        const remaining = state.until - this.now();
        if (remaining <= 0) break;
        await this.sleep(remaining);
      }
      if (this.states.get(origin) === state) this.states.delete(origin);
    })();
    this.states.set(origin, state);
    return state.promise;
  }

  reset() {
    this.states.clear();
  }
}

export const apiRateLimitCoordinator = new ApiRateLimitCoordinator();
