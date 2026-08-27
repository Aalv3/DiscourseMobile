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
    // Media V1 is available only when the signed app supplies one of the two
    // approved OTA channels. The site must still match that channel's exact
    // canonical origin, and the Discourse upload allowlist remains the final
    // server-side enforcement boundary.
    mediaUploads: updateChannel !== null,
    publicNativePreview: false,
  }),
  push: Object.freeze({
    backendOrigin: canonicalOriginForChannel(updateChannel),
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
  if (adjusterNetwork.features.mediaUploads !== true) return false;
  return mediaUploadsEnabledForChannelSite(updateChannel, site);
}

export function mediaUploadsEnabledForChannelSite(channel, site) {
  const trustedChannel = trustedUpdateChannel(channel);
  const expectedOrigin = canonicalOriginForChannel(trustedChannel);
  if (!expectedOrigin) return false;
  try {
    const origin = new URL(site?.url).origin;
    return origin === expectedOrigin;
  } catch {
    return false;
  }
}
