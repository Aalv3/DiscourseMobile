/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@AdjusterNetwork.profileDiagnostics.v1';
const MAX_ENTRIES = 160;
const ALLOWED_KEYS = new Set([
  'timestamp',
  'event',
  'mountId',
  'sequence',
  'currentSequence',
  'outcome',
  'stage',
  'category',
  'loading',
  'error',
  'branch',
  'source',
  'dependency',
]);
let write = Promise.resolve();
let mountCounter = 0;

const bounded = value => String(value ?? 'none').slice(0, 48);

export function createProfileMountId() {
  mountCounter += 1;
  return `profile-${Date.now().toString(36)}-${mountCounter}`;
}

export function profileErrorCategory(error) {
  const status = Number(error?.status);
  if (status === 429) return '429';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (error?.code === 'profile_load_timeout') return 'timeout';
  return 'network_or_unknown';
}

export function recordProfileDiagnostic(input) {
  const entry = { timestamp: Date.now() };
  Object.entries(input || {}).forEach(([key, value]) => {
    if (!ALLOWED_KEYS.has(key) || value === undefined) return;
    if (['sequence', 'currentSequence'].includes(key)) {
      entry[key] = Number.isFinite(Number(value)) ? Number(value) : -1;
    } else if (['loading'].includes(key)) {
      entry[key] = value === true;
    } else {
      entry[key] = bounded(value);
    }
  });
  write = write
    .then(async () => {
      let entries = [];
      try {
        const stored = await AsyncStorage.getItem(KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) entries = parsed;
      } catch {
        // Diagnostics never affect profile behavior.
      }
      entries.push(entry);
      await AsyncStorage.setItem(
        KEY,
        JSON.stringify(entries.slice(-MAX_ENTRIES)),
      );
    })
    .catch(() => {});
  return entry;
}

export const profileDiagnosticKey = KEY;
export const profileDiagnosticLimit = MAX_ENTRIES;
