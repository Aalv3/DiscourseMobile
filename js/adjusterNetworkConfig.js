/* @flow */
'use strict';

// Keep Adjuster Network product choices in one reversible boundary. Native
// identifiers, signing, push credentials, and upstream site management remain
// untouched until their separate release gates are satisfied.
export const adjusterNetwork = Object.freeze({
  name: 'Adjuster Network',
  canonicalOrigin: 'https://adjusternetwork.org',
  navigation: Object.freeze({
    floor: Object.freeze({ label: 'Floor', route: 'Home', available: true }),
    activity: Object.freeze({
      label: 'Activity',
      route: 'Notifications',
      available: true,
    }),
    ask: Object.freeze({ label: 'Ask', route: null, available: false }),
    cat: Object.freeze({ label: 'CAT', route: null, available: false }),
    you: Object.freeze({ label: 'You', route: null, available: false }),
  }),
});
