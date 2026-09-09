/* @flow */
'use strict';

import { AUTH_REDIRECT } from './authorizationConsent';
import { isCanonicalUrl } from './adjusterNetworkSecurity';
import { parseAuthCallbackParameters } from './authCallback';
import { profileErrorCategory } from './profileDiagnostics';

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
// The JSON route is requested explicitly. create_otp responds to both HTML and
// JSON, and site.jsonApi sends no Accept header, so without the extension the
// server would answer format.html with a 302 to the custom scheme, which fetch
// cannot follow.
export const OTP_ENDPOINT = '/user-api-key/otp.json';

// Coarse stages for production diagnostics. Enough to say where a bootstrap
// failed without recording response bodies, keys, tokens or OTP values.
export const WEB_SESSION_STAGES = Object.freeze({
  otpRequest: 'otp_request',
  otpResponseParse: 'otp_response_parse',
  otpCallbackParse: 'otp_callback_parse',
  otpDecrypt: 'otp_decrypt',
  otpValidation: 'otp_validation',
  webviewBootstrap: 'webview_bootstrap',
  destinationResume: 'destination_resume',
});

export function webSessionFailure(stage, cause) {
  const error = new Error(`web_session_${stage}`);
  error.stage = stage;
  // profileErrorCategory yields only 429 / 5xx / 4xx / timeout /
  // network_or_unknown - never a body.
  error.category = profileErrorCategory(cause);
  return error;
}

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
  const stages = WEB_SESSION_STAGES;
  if (!site?.authToken) throw webSessionFailure(stages.otpRequest);
  await siteManager.ensureRSAKeys();
  const publicKey = siteManager.rsaKeys?.public;
  if (!publicKey) throw webSessionFailure(stages.otpRequest);

  // UserApiKeysController#require_params_otp requires public_key,
  // auth_redirect and application_name; omitting application_name is a 400.
  // application_name reuses siteManager.deviceName, the same value the
  // authorization flow sends, rather than inventing a second identity.
  let payload;
  try {
    // Reuses site.jsonApi, so the existing User-Api-Key and
    // User-Api-Client-Id headers, rate-limit buckets and cooldowns all apply.
    payload = await site.jsonApi(OTP_ENDPOINT, 'POST', {
      public_key: publicKey,
      auth_redirect: AUTH_REDIRECT,
      application_name: siteManager.deviceName,
      padding: 'pkcs1',
    });
  } catch (cause) {
    throw webSessionFailure(stages.otpRequest, cause);
  }

  if (!payload || typeof payload.redirect_url !== 'string') {
    throw webSessionFailure(stages.otpResponseParse);
  }

  const encrypted = parseAuthCallbackParameters(
    payload.redirect_url,
  ).oneTimePassword;
  if (!encrypted) throw webSessionFailure(stages.otpCallbackParse);

  // Same JSEncrypt private key as the authorization flow; no second
  // cryptographic implementation.
  let otp;
  try {
    otp = siteManager.decryptHelper(encrypted);
  } catch (cause) {
    throw webSessionFailure(stages.otpDecrypt, cause);
  }
  if (!otp) throw webSessionFailure(stages.otpDecrypt);
  if (typeof otp !== 'string' || !OTP_TOKEN.test(otp)) {
    throw webSessionFailure(stages.otpValidation);
  }
  return otp;
}

// Resolves what the WebView should load for a first-party destination: the
// destination directly when a session already exists, otherwise a bootstrap
// that remembers where to go afterwards.
export async function resolveWebSessionEntry(site, siteManager, destination) {
  if (!isCanonicalUrl(destination)) {
    throw webSessionFailure(WEB_SESSION_STAGES.webviewBootstrap);
  }
  if (await hasAuthenticatedWebSession(site)) {
    return { url: destination, destination: null };
  }
  const otp = await requestOneTimePassword(site, siteManager);
  const bootstrap = otpBootstrapUrl(site, otp);
  if (!bootstrap) {
    throw webSessionFailure(WEB_SESSION_STAGES.webviewBootstrap);
  }
  return { url: bootstrap, destination };
}
