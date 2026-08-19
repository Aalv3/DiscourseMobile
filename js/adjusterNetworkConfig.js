/* @flow */
'use strict';

import { NativeModules, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { nativeContracts } from './adjusterNetworkContracts';

export function trustedPushEnvironment(platform, configured) {
  if (platform !== 'ios') return null;
  return configured === 'staging' || configured === 'production'
    ? configured
    : null;
}

const pushEnvironment = trustedPushEnvironment(
  Platform.OS,
  NativeModules.DiscourseKeyboardShortcuts?.pushEnvironment,
);

export const trustedUpdateChannel = channel =>
  channel === 'staging' || channel === 'production' ? channel : null;

export const canonicalOriginForChannel = channel =>
  channel === 'staging'
    ? 'https://staging.adjusternetwork.org'
    : channel === 'production'
    ? 'https://adjusternetwork.org'
    : null;

const updateChannel = trustedUpdateChannel(Updates.channel);

// Keep Adjuster Network product choices in one reversible boundary. Native
// identifiers, signing, push credentials, and upstream site management remain
// untouched until their separate release gates are satisfied.
export const adjusterNetwork = Object.freeze({
  name: 'Adjuster Network',
  canonicalOrigin: canonicalOriginForChannel(updateChannel),
  features: Object.freeze({
    analytics: false,
    crashReporting: false,
    push: false,
    pushEducation: true,
    // Enables device registration with the A3-owned dark backend. Server-side
    // delivery switches remain authoritative and OFF during certification.
    pushDelivery: true,
    // Build 3 keeps the approved attachment client dormant until the separate
    // server/storage/media-security certification is complete. The backend
    // upload allowlist remains the final enforcement boundary.
    mediaUploads: false,
    // Physical certification may exercise the client only against this exact
    // isolated origin. The production origin remains disabled above.
    mediaUploadOrigins: Object.freeze(['https://staging.adjusternetwork.org']),
    publicNativePreview: false,
  }),
  push: Object.freeze({
    backendOrigin: 'https://adjusternetwork.org',
    // Injected by signed build configuration and exported by the native
    // module. Missing or unexpected values fail closed; users cannot switch it.
    environment: pushEnvironment,
  }),
  navigation: Object.freeze({
    floor: Object.freeze({
      label: 'Floor',
      route: nativeContracts.destinations.floor.route,
      available: true,
    }),
    activity: Object.freeze({
      label: 'Activity',
      route: nativeContracts.destinations.activity.route,
      available: true,
    }),
    ask: Object.freeze({
      label: 'Ask',
      route: nativeContracts.destinations.ask.route,
      available: false,
    }),
    cat: Object.freeze({
      label: 'CAT',
      route: nativeContracts.destinations.cat.route,
      available: false,
    }),
    you: Object.freeze({
      label: 'You',
      route: nativeContracts.destinations.you.route,
      available: false,
    }),
  }),
});

export function mediaUploadsEnabledForSite(site) {
  if (adjusterNetwork.features.mediaUploads === true) return true;
  try {
    const origin = new URL(site?.url).origin;
    return adjusterNetwork.features.mediaUploadOrigins.includes(origin);
  } catch {
    return false;
  }
}
