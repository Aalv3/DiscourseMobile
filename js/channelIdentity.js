/* @flow */
'use strict';

// Pure channel-derived identity. Deliberately dependency-free so it can be
// imported by both the product config and the authorization module without
// creating a cycle between them.
//
// The channel is compiled into the binary by an Xcode build phase and sent as
// the expo-channel-name request header. It is never selectable at runtime: a
// Production binary cannot become a Preview one, and nothing here can let an
// installed app change which server it talks to.

export const trustedUpdateChannel = channel =>
  channel === 'staging' || channel === 'production' || channel === 'preview'
    ? channel
    : null;

// Preview is a founder-only validation lane that deliberately points at the
// REAL production origin, so what it exercises is real production behaviour
// with real member data. Only the app identity is separate; the server is not.
export const canonicalOriginForChannel = channel =>
  channel === 'staging'
    ? 'https://staging.adjusternetwork.org'
    : channel === 'production' || channel === 'preview'
    ? 'https://adjusternetwork.org'
    : null;

// Preview must not claim Production's custom scheme. Two installed apps
// registering the same scheme is undefined on iOS, and the auth callback could
// be delivered to the wrong app.
export const authSchemeForChannel = channel =>
  channel === 'preview' ? 'anpreview' : 'adjusternetwork';

export const authRedirectForChannel = channel =>
  `${authSchemeForChannel(channel)}://adjusternetwork.org/auth_redirect`;

export const isPreviewChannel = channel => channel === 'preview';
