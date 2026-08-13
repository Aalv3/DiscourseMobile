/* @flow */
'use strict';

import { nativeContracts } from './adjusterNetworkContracts';

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
    environment: 'development',
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
