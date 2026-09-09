/* @flow */
'use strict';

import { NativeModules, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { nativeContracts } from './adjusterNetworkContracts';
import {
  authRedirectForChannel,
  authSchemeForChannel,
  canonicalOriginForChannel,
  isPreviewChannel,
  trustedUpdateChannel,
} from './channelIdentity';

// Re-exported so existing import sites keep working unchanged.
export {
  authRedirectForChannel,
  authSchemeForChannel,
  canonicalOriginForChannel,
  isPreviewChannel,
  trustedUpdateChannel,
};

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

const updateChannel = trustedUpdateChannel(Updates.channel);

// Keep Adjuster Network product choices in one reversible boundary. Native
// identifiers, signing, push credentials, and upstream site management remain
// untouched until their separate release gates are satisfied.
export const adjusterNetwork = Object.freeze({
  name: 'Adjuster Network',
  channel: updateChannel,
  // Founder-only validation build. Drives the persistent PREVIEW marker, and
  // nothing else: Preview must behave exactly like Production so that what is
  // validated is what ships.
  preview: isPreviewChannel(updateChannel),
  authScheme: authSchemeForChannel(updateChannel),
  authRedirect: authRedirectForChannel(updateChannel),
  canonicalOrigin: canonicalOriginForChannel(updateChannel),
  features: Object.freeze({
    analytics: false,
    crashReporting: false,
    push: false,
    pushEducation: true,
    // Enables device registration with the A3-owned dark backend. Server-side
    // delivery switches remain authoritative and OFF during certification.
    // Preview cannot receive push in V1 - the server pins the APNs topic to
    // the production bundle id - so it does not register a device at all
    // rather than creating registrations that can never be delivered to.
    pushDelivery: !isPreviewChannel(updateChannel),
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
