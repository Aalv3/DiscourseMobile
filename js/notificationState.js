/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';

const DIAGNOSTIC_KEY = '@AdjusterNetwork.notificationDiagnostics.v1';
const MAX_DIAGNOSTICS = 100;

export const SUPPORTED_NOTIFICATION_TYPES = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 36, 37, 38, 800, 801, 802,
]);

export const supportedNotification = notification =>
  SUPPORTED_NOTIFICATION_TYPES.has(notification?.notification_type);

export const actionableUnreadRows = rows =>
  (Array.isArray(rows) ? rows : []).filter(
    row => supportedNotification(row?.notification) && !row.notification.read,
  );

const boundedCount = value =>
  Number.isInteger(value) && value >= 0 ? Math.min(value, 9999) : null;

let diagnosticWrite = Promise.resolve();

export function recordNotificationDiagnostic(input) {
  const entry = {
    timestamp: Date.now(),
    event: String(input?.event || 'unknown').slice(0, 40),
    reason: String(input?.reason || 'unknown').slice(0, 40),
    outcome: String(input?.outcome || 'none').slice(0, 24),
    status: String(input?.status || 'none').slice(0, 16),
    prior: boundedCount(input?.prior),
    result: boundedCount(input?.result),
    authoritative: boundedCount(input?.authoritative),
  };
  diagnosticWrite = diagnosticWrite
    .then(async () => {
      let entries = [];
      try {
        const stored = await AsyncStorage.getItem(DIAGNOSTIC_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) entries = parsed;
      } catch {
        // Invalid or unavailable diagnostics never affect notification state.
      }
      entries.push(entry);
      await AsyncStorage.setItem(
        DIAGNOSTIC_KEY,
        JSON.stringify(entries.slice(-MAX_DIAGNOSTICS)),
      );
    })
    .catch(() => {});
  return entry;
}

export const notificationDiagnosticKey = DIAGNOSTIC_KEY;
