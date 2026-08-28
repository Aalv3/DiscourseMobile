/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@AdjusterNetwork.pushStatusDiagnostics.v1';
const MAX_ENTRIES = 100;
const safe = (value, fallback = 'unknown') =>
  String(value || fallback).slice(0, 40);
let write = Promise.resolve();

export function recordPushStatusTransition(input) {
  const foundation = input?.foundation || {};
  const entry = {
    timestamp: Date.now(),
    reason: safe(input?.reason),
    previous: safe(input?.previous),
    next: safe(input?.next),
    knownEnabled: input?.knownEnabled === true,
    permission: safe(foundation.permission),
    preference: safe(foundation.preference),
    backend: safe(foundation.backend),
    category: safe(input?.result?.category, 'none'),
    outcome: safe(input?.result?.outcome, 'none'),
    http: safe(input?.result?.httpStatusClass, 'none'),
  };
  write = write
    .then(async () => {
      let entries = [];
      try {
        const stored = await AsyncStorage.getItem(KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) entries = parsed;
      } catch {
        // Diagnostics never affect notification setup.
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

export const pushStatusDiagnosticKey = KEY;
