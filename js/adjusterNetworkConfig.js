/* @flow */
'use strict';

import { NativeModules, Platform } from 'react-native';
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

// Keep Adjuster Network product choices in one reversible boundary. Native
// identifiers, signing, push credentials, and upstream site management remain
// untouched until their separate release gates are satisfied.
export const adjusterNetwork = Object.freeze({
  name: 'Adjuster Network',
  canonicalOrigin: 'https://adjusternetwork.org',
  features: Object.freeze({
    analytics: false,
    crashReporting: false,
    push: false,
    pushEducation: true,
    // Enables device registration with the A3-owned dark backend. Server-side
    // delivery switches remain authoritative and OFF during certification.
    pushDelivery: true,
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
