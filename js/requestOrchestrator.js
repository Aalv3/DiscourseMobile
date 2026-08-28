/* @flow */
'use strict';

import { retryAfterDelayMs } from './apiRateLimit';
import { recordRequestLedger } from './requestLedgerDiagnostics';

const MAX_CONCURRENCY = 3;
const CACHE_LIMIT = 96;
const LEDGER_LIMIT = 256;
const PRIORITY = { bootstrap: 0, visible: 1, background: 2 };

const endpointFamily = path => {
  if (path.startsWith('/native/v1/profile/photo')) return 'profile-photo';
  if (path.startsWith('/native/v1/profile/resume')) return 'profile-resume';
  if (path.startsWith('/native/v1/profile')) return 'profile';
  if (path.startsWith('/native/v1/notifications')) return 'notifications';
  if (path.startsWith('/native/v1/onboarding')) return 'onboarding';
  if (path.startsWith('/native/v1/push/')) return 'push';
  return path.split('?')[0].split('/').slice(0, 3).join('/') || 'root';
};

export function limiterBucket({ origin, clientId, path, errorCode }) {
  if (
    errorCode === 'user_api_key_limiter_60_secs' ||
    errorCode === 'user_api_key_limiter_1_day'
  ) {
    return `${origin}:user-api:${clientId || 'unknown'}`;
  }
  if (errorCode === 'ip_10_secs_limit' || errorCode === 'ip_60_secs_limit') {
    return `${origin}:ip`;
  }
  if (errorCode?.startsWith('an_')) return `${origin}:native:${errorCode}`;
  return `${origin}:class:${endpointFamily(path)}`;
}

export class RequestOrchestrator {
  constructor({ now = () => Date.now(), sleep } = {}) {
    this.now = now;
    this.sleep =
      sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.inflight = new Map();
    this.cache = new Map();
    this.cooldowns = new Map();
    this.retryAdmissions = new Map();
    this.queue = [];
    this.active = 0;
    this.ledger = [];
    this.sequence = 0;
  }

  record(event) {
    const safeEvent = {
      ...event,
      key: event.key
        ? String(event.key).replace(/^.*:(GET|POST|PUT|PATCH|DELETE):/, '$1:')
        : undefined,
      bucket: event.bucket
        ? String(event.bucket).replace(/^https?:\/\/[^:]+:/, '')
        : undefined,
    };
    this.ledger.push({ at: this.now(), ...safeEvent });
    if (this.ledger.length > LEDGER_LIMIT)
      this.ledger.splice(0, this.ledger.length - LEDGER_LIMIT);
    recordRequestLedger(event);
  }

  snapshotLedger() {
    return this.ledger.map(entry => ({ ...entry }));
  }

  async waitForBucket(bucket) {
    const until = this.cooldowns.get(bucket) || 0;
    const remaining = until - this.now();
    if (remaining > 0) {
      this.record({
        event: 'cooldown_wait',
        bucket,
        durationClass: remaining < 10000 ? 'short' : 'long',
      });
      await this.sleep(remaining + (this.sequence++ % 3) * 40);
    }
    if ((this.cooldowns.get(bucket) || 0) <= this.now())
      this.cooldowns.delete(bucket);
  }

  beginCooldown(bucket, response, retryIndex) {
    const delay = retryAfterDelayMs(response, retryIndex);
    this.cooldowns.set(
      bucket,
      Math.max(this.cooldowns.get(bucket) || 0, this.now() + delay),
    );
    this.record({
      event: 'cooldown_begin',
      bucket,
      status: 429,
      durationClass: delay < 10000 ? 'short' : 'long',
    });
    return delay;
  }

  admitRetry(bucket) {
    const previous = this.retryAdmissions.get(bucket) || Promise.resolve();
    const admission = previous
      .catch(() => {})
      .then(async () => {
        await this.waitForBucket(bucket);
        await this.sleep(120 + (this.sequence++ % 4) * 40);
        await this.waitForBucket(bucket);
      });
    this.retryAdmissions.set(bucket, admission);
    admission
      .finally(() => {
        if (this.retryAdmissions.get(bucket) === admission) {
          this.retryAdmissions.delete(bucket);
        }
      })
      .catch(() => {});
    return admission;
  }

  request({ key, task, priority = 'visible', ttlMs = 0, allowStale = false }) {
    const cached = this.cache.get(key);
    if (cached && (cached.expiresAt > this.now() || allowStale)) {
      this.record({ event: 'cache_hit', key });
      if (cached.expiresAt <= this.now() && !this.inflight.has(key)) {
        this._enqueue({ key, task, priority: 'background', ttlMs }).catch(
          () => {},
        );
      }
      return Promise.resolve(cached.value);
    }
    if (this.inflight.has(key)) {
      this.record({ event: 'coalesced', key });
      return this.inflight.get(key);
    }
    return this._enqueue({ key, task, priority, ttlMs });
  }

  _enqueue(job) {
    const promise = new Promise((resolve, reject) => {
      this.queue.push({ ...job, resolve, reject, order: this.sequence++ });
      this.queue.sort(
        (a, b) =>
          (PRIORITY[a.priority] ?? 1) - (PRIORITY[b.priority] ?? 1) ||
          a.order - b.order,
      );
      this.record({ event: 'queued', key: job.key, priority: job.priority });
      this._drain();
    });
    this.inflight.set(job.key, promise);
    promise
      .finally(() => {
        if (this.inflight.get(job.key) === promise)
          this.inflight.delete(job.key);
      })
      .catch(() => {});
    return promise;
  }

  _drain() {
    while (this.active < MAX_CONCURRENCY && this.queue.length) {
      const job = this.queue.shift();
      this.active += 1;
      this.record({ event: 'started', key: job.key, active: this.active });
      let execution;
      try {
        execution = job.task();
      } catch (error) {
        execution = Promise.reject(error);
      }
      Promise.resolve(execution)
        .then(
          value => {
            if (job.ttlMs > 0) {
              this.cache.set(job.key, {
                value,
                expiresAt: this.now() + job.ttlMs,
              });
              while (this.cache.size > CACHE_LIMIT)
                this.cache.delete(this.cache.keys().next().value);
            }
            this.record({ event: 'settled', key: job.key, outcome: 'success' });
            job.resolve(value);
          },
          error => {
            this.record({
              event: 'settled',
              key: job.key,
              outcome: 'failure',
              status: error?.status || 'network',
            });
            job.reject(error);
          },
        )
        .finally(() => {
          this.active -= 1;
          this._drain();
        });
    }
  }

  reset() {
    this.inflight.clear();
    this.cache.clear();
    this.cooldowns.clear();
    this.retryAdmissions.clear();
    this.queue = [];
    this.ledger = [];
    this.active = 0;
  }
}

export const requestOrchestrator = new RequestOrchestrator();
