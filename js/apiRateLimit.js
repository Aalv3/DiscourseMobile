/* @flow */
'use strict';

export const RATE_LIMIT_FALLBACK_MS = Object.freeze([2000, 5000]);
export const RATE_LIMIT_MIN_MS = 1000;
// Two independent ceilings. RATE_LIMIT_MAX_MS bounds how long a single request
// may block, so auth, logout and session recovery can never hang.
// RATE_LIMIT_COOLDOWN_MAX_MS bounds the recorded cooldown lifetime, which the
// server directs through Retry-After. Production has returned values up to
// 136s; clamping the cooldown to the per-request ceiling made GET chains
// re-enter a known-active window at ~60s and ~120s.
export const RATE_LIMIT_MAX_MS = 60000;
export const RATE_LIMIT_COOLDOWN_MAX_MS = 180000;
export const RATE_LIMIT_MAX_RETRIES = 2;

const bounded = (value, max) =>
  Math.min(max, Math.max(RATE_LIMIT_MIN_MS, value));
const boundedDelay = value => bounded(value, RATE_LIMIT_MAX_MS);
const boundedCooldown = value => bounded(value, RATE_LIMIT_COOLDOWN_MAX_MS);

function parseRetryAfterMs(value, now) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, timestamp - now);
}

export function retryAfterDelayMs(value, now = Date.now()) {
  const raw = parseRetryAfterMs(value, now);
  return raw === null ? null : boundedDelay(raw);
}

export function retryAfterCooldownMs(value, now = Date.now()) {
  const raw = parseRetryAfterMs(value, now);
  return raw === null ? null : boundedCooldown(raw);
}

export function rateLimitDelayMs(response, retryIndex, now = Date.now()) {
  const directed = retryAfterDelayMs(
    response?.headers?.get?.('Retry-After'),
    now,
  );
  return directed ?? RATE_LIMIT_FALLBACK_MS[retryIndex] ?? RATE_LIMIT_MAX_MS;
}

// The cooldown lifetime honors the directed value up to the cooldown ceiling.
export function rateLimitCooldownMs(response, retryIndex, now = Date.now()) {
  const directed = retryAfterCooldownMs(
    response?.headers?.get?.('Retry-After'),
    now,
  );
  return (
    directed ??
    boundedCooldown(RATE_LIMIT_FALLBACK_MS[retryIndex] ?? RATE_LIMIT_MAX_MS)
  );
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
