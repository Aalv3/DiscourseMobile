/* @flow */
'use strict';

// Presentation decision for a classified member destination. Kept pure and
// separate from Discourse.js so every branch is directly testable.
//
// A 'first_party_web' destination is a valid first-party member page with no
// native screen. It is opened in the in-app WebView, but only after an
// authenticated Discourse session has been bootstrapped - see webViewSession.
// Loading it without one would show a login wall, which is exactly what
// WebViewComponent's navigation policy exists to prevent.
export const WEB_SESSION_UNAVAILABLE = Object.freeze({
  title: 'Not available right now',
  message:
    'Adjuster Network could not open this page in the app. It has been marked as read, and nothing else is affected. Try again later.',
  close: 'Close',
});

export function destinationPresentation(route) {
  switch (route?.disposition) {
    case 'native':
      return { kind: 'native', screen: route.screen, params: route.params };
    case 'first_party_web':
      return { kind: 'web', url: route.url };
    case 'privileged_external':
      return { kind: 'external', url: route.url };
    default:
      // Off-origin, unauthenticated, non-staff /admin, malformed or unknown.
      return { kind: 'denied' };
  }
}
