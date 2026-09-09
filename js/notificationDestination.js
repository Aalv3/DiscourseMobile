/* @flow */
'use strict';

// Presentation decision for a classified member destination. Kept pure and
// separate from Discourse.js so every branch is directly testable.
//
// There is no in-between disposition here. A destination either has a native
// screen or it does not; one that does not ends in an explicit bounded state.
// Opening a canonical page in a WebView to work around a missing native screen
// was tried and abandoned - see docs/NATIVE-NOTIFICATION-INTENTS.md.
export const NOTIFICATION_UNAVAILABLE = Object.freeze({
  title: 'Not available in the app yet',
  message:
    'Adjuster Network cannot open this notification in the app yet. It has been marked as read, and nothing else is affected.',
  close: 'Close',
});

export function destinationPresentation(route) {
  switch (route?.disposition) {
    case 'native':
      return { kind: 'native', screen: route.screen, params: route.params };
    case 'privileged_external':
      return { kind: 'external', url: route.url };
    default:
      // Off-origin, unauthenticated, non-staff /admin, malformed or unknown.
      return { kind: 'denied' };
  }
}
