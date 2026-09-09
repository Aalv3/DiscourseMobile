/* @flow */
'use strict';

import * as Updates from 'expo-updates';
import { getOtaDiagnostics } from './otaDiagnostics';
import { credentialStore } from './secureCredentialStore';
import { adjusterNetwork } from './adjusterNetworkConfig';

// A temporary certification aid for the permanent internal staging client.
// It is gated on the trusted OTA channel, so it can never render on a
// production binary or a production OTA even if this bundle is republished.
export function stagingDiagnosticsEnabled(channel = Updates.channel) {
  return channel === 'staging';
}

// Opened inside the same ASWebAuthenticationSession the sign-in flow uses.
// An ephemeral session has an empty cookie jar, so the canonical origin must
// report an anonymous visitor. Anything else proves the browser-auth context
// is still sharing the system Safari session.
export function browserSessionProbeUrl(
  origin = adjusterNetwork.canonicalOrigin,
) {
  return origin ? `${origin}/session/current.json` : null;
}

export async function collectStagingDiagnostics(updates = Updates) {
  const ota = getOtaDiagnostics(updates);
  let retainedCredential = 'unknown';
  try {
    const origin = adjusterNetwork.canonicalOrigin;
    const token = origin ? await credentialStore.readSiteToken(origin) : null;
    // Never surface the credential itself, only whether one survived.
    retainedCredential = token ? 'present' : 'absent';
  } catch {
    retainedCredential = 'unreadable';
  }
  return Object.freeze({ ...ota, retainedCredential });
}
