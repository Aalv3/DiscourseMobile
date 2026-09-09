/* @flow */
'use strict';

import { AUTH_REDIRECT } from './authorizationConsent';
import { isCanonicalUrl } from './adjusterNetworkSecurity';
import { parseAuthCallbackParameters } from './authCallback';

// Bootstrapping an authenticated Discourse browser session for the in-app
// WebView. The WebView carries cookies, not the User API key, so a first-party
// member page cannot be opened until a session cookie exists.
//
// The supported contract: POST /user-api-key/otp with the app's existing User
// API credentials returns a redirect_url carrying an RSA-encrypted one-time
// password. The app decrypts it with the same private key used by the
// authorization flow and loads /session/otp/<otp>, where the member completes
// the existing confirmation form. That form - never bypassed - is what sets the
// session cookie.
//
// The OTP is single-use with a 10 minute TTL, and the server refuses User API
// keys for suspended or inactive users, so an unauthorised member cannot reach
// a session this way.
export const OTP_BOOTSTRAP_PATH = '/session/otp/';
export const OTP_ENDPOINT = '/user-api-key/otp';

// Discourse's authentication cookie. Its presence means the WebView already
// holds a logged-in session and no OTP needs to be minted.
const AUTH_COOKIE = '_t';

// The route constrains the token to hex, so anything else must never be
// interpolated into the path.
const OTP_TOKEN = /^[0-9a-f]+$/;

export function otpBootstrapUrl(site, otp) {
  if (!site?.url || typeof otp !== 'string' || !OTP_TOKEN.test(otp)) {
    return null;
  }
  return `${site.url}${OTP_BOOTSTRAP_PATH}${otp}`;
}

export function isOtpBootstrapUrl(value) {
  if (!isCanonicalUrl(value)) return false;
  try {
    return new URL(value).pathname.startsWith(OTP_BOOTSTRAP_PATH);
  } catch {
    return false;
  }
}

export async function hasAuthenticatedWebSession(site, cookies = null) {
  if (!site?.url) return false;
  try {
    // Required lazily so importing this module never pulls in the native
    // cookie package. Suites that merely reach Discourse.js must not have to
    // mock it, and nothing else in this module needs it.
    const jar = await (cookies || require('@react-native-cookies/cookies')).get(
      site.url,
      true,
    );
    const token = jar?.[AUTH_COOKIE];
    return Boolean(token && token.value);
  } catch {
    // An unreadable cookie jar is treated as no session: the worst outcome is
    // minting one extra single-use OTP.
    return false;
  }
}

export async function requestOneTimePassword(site, siteManager) {
  if (!site?.authToken) throw new Error('web_session_unauthenticated');
  await siteManager.ensureRSAKeys();
  const publicKey = siteManager.rsaKeys?.public;
  if (!publicKey) throw new Error('web_session_key_unavailable');

  // Reuses site.jsonApi, so the existing User-Api-Key and User-Api-Client-Id
  // headers, rate-limit buckets and cooldowns all apply unchanged.
  const payload = await site.jsonApi(OTP_ENDPOINT, 'POST', {
    public_key: publicKey,
    auth_redirect: AUTH_REDIRECT,
    padding: 'pkcs1',
  });

  const encrypted = parseAuthCallbackParameters(
    payload?.redirect_url,
  ).oneTimePassword;
  if (!encrypted) throw new Error('web_session_otp_missing');

  // Same JSEncrypt private key as the authorization flow; no second
  // cryptographic implementation.
  const otp = siteManager.decryptHelper(encrypted);
  if (typeof otp !== 'string' || !OTP_TOKEN.test(otp)) {
    throw new Error('web_session_otp_invalid');
  }
  return otp;
}

// Resolves what the WebView should load for a first-party destination: the
// destination directly when a session already exists, otherwise a bootstrap
// that remembers where to go afterwards.
export async function resolveWebSessionEntry(site, siteManager, destination) {
  if (!isCanonicalUrl(destination)) throw new Error('web_session_destination');
  if (await hasAuthenticatedWebSession(site)) {
    return { url: destination, destination: null };
  }
  const otp = await requestOneTimePassword(site, siteManager);
  const bootstrap = otpBootstrapUrl(site, otp);
  if (!bootstrap) throw new Error('web_session_otp_invalid');
  return { url: bootstrap, destination };
}
