/* @flow */
'use strict';

// Presentation decision for a classified member destination. Kept pure and
// separate from Discourse.js so every branch is directly testable.
//
// A 'first_party_web' destination is recognised and valid, but the app cannot
// open it safely today. The in-app WebView has no authenticated Discourse
// session: the OTP that establishes one is issued only as part of an
// ASWebAuthenticationSession authorization callback, and Discourse core exposes
// no on-demand OTP route to mint another. WebViewComponent's own navigation
// policy blocks these destinations for exactly that reason, which is what
// produced a blank screen stuck on "Still loading...". Rather than navigate
// into that dead end, or load the page unauthenticated and show a login wall,
// the member is told plainly.
export const FIRST_PARTY_WEB_UNAVAILABLE = Object.freeze({
  title: 'Not available in the app',
  message:
    'This notification links to a page the app cannot open yet. It has been marked as read, and nothing else is affected.',
  close: 'Close',
});

export function destinationPresentation(route) {
  switch (route?.disposition) {
    case 'native':
      return { kind: 'native', screen: route.screen, params: route.params };
    case 'first_party_web':
      return { kind: 'unavailable', copy: FIRST_PARTY_WEB_UNAVAILABLE };
    case 'privileged_external':
      return { kind: 'external', url: route.url };
    default:
      // Off-origin, unauthenticated, non-staff /admin, malformed or unknown.
      return { kind: 'denied' };
  }
}

// No supported destination ever loads the WebView today. This is asserted so a
// future change cannot quietly reintroduce the unauthenticated blank screen.
export function opensWebView(route) {
  return destinationPresentation(route).kind === 'webview';
}
