/* @flow */
'use strict';

import * as Updates from 'expo-updates';

const safeString = value =>
  typeof value === 'string' && value.length > 0 ? value : null;

export const getOtaDiagnostics = (updates = Updates) => {
  const manifest = updates.manifest || {};
  const otaExtra = manifest.extra?.ota || {};

  return Object.freeze({
    enabled: !!updates.isEnabled,
    updateId: safeString(updates.updateId),
    gitSha: safeString(otaExtra.gitSha),
    runtimeVersion: safeString(updates.runtimeVersion),
    channel: safeString(updates.channel),
    source: updates.isEmbeddedLaunch ? 'embedded' : 'remote',
    emergencyLaunch: !!updates.isEmergencyLaunch,
    createdAt:
      updates.createdAt instanceof Date
        ? updates.createdAt.toISOString()
        : safeString(updates.createdAt),
  });
};
