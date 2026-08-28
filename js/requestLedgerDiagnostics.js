/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@AdjusterNetwork.requestLedger.v1';
const LIMIT = 256;
const ALLOWED_EVENTS = new Set([
  'queued',
  'started',
  'settled',
  'coalesced',
  'cache_hit',
  'cooldown_begin',
  'cooldown_wait',
]);
let write = Promise.resolve();

const safeResource = key => {
  const match = String(key || '').match(
    /:(GET|POST|PUT|PATCH|DELETE):(\/[^?]*)/,
  );
  return match ? `${match[1]}:${match[2]}`.slice(0, 96) : 'request-class';
};

const safeBucket = bucket => {
  const value = String(bucket || 'unknown');
  if (value.includes(':user-api:')) return 'global-user-api';
  if (value.endsWith(':ip')) return 'global-ip';
  const native = value.match(/:native:([a-z0-9_]+)/);
  if (native) return `native:${native[1]}`;
  const family = value.match(/:class:([^:]+)$/);
  return family ? `class:${family[1]}`.slice(0, 64) : 'unknown';
};

export function recordRequestLedger(input) {
  if (!ALLOWED_EVENTS.has(input?.event)) return;
  const entry = {
    timestamp: Date.now(),
    event: input.event,
    resource: safeResource(input.key),
    bucket: safeBucket(input.bucket),
    priority: ['bootstrap', 'visible', 'background'].includes(input.priority)
      ? input.priority
      : 'none',
    outcome: ['success', 'failure'].includes(input.outcome)
      ? input.outcome
      : 'none',
    status:
      Number.isFinite(Number(input.status)) && Number(input.status) >= 100
        ? `${Math.floor(Number(input.status) / 100)}xx`
        : input.status === 'network'
        ? 'network'
        : 'none',
    active: Math.max(0, Math.min(3, Number(input.active) || 0)),
    durationClass: ['short', 'long'].includes(input.durationClass)
      ? input.durationClass
      : 'none',
  };
  write = write
    .then(async () => {
      let rows = [];
      try {
        const stored = await AsyncStorage.getItem(KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) rows = parsed;
      } catch {
        // Diagnostics never alter request admission.
      }
      rows.push(entry);
      await AsyncStorage.setItem(KEY, JSON.stringify(rows.slice(-LIMIT)));
    })
    .catch(() => {});
}

export const requestLedgerKey = KEY;
export const requestLedgerLimit = LIMIT;
