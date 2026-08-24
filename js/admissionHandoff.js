/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { adjusterNetwork } from './adjusterNetworkConfig';

export const ADMISSION_HANDOFF_SCOPE =
  'adjuster-network-renaissance:admission_handoff';
export const ADMISSION_RETURN_URI = 'adjusternetwork://auth_redirect';
export const ADMISSION_HANDOFF_STORAGE = '@AdjusterNetwork.admissionHandoff';
export const ADMISSION_RESULTS = Object.freeze([
  'confirmation_required',
  'success',
  'refused',
  'interrupted',
  'expired',
  'invalid',
  'already_used',
]);

const HANDOFF_PATH = '/renaissance/admission-handoff';
const FINALIZE_PATH = '/renaissance/admission-handoff/finalize';
const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRMATION_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const confirmationSecrets = new Map();

export function validateIssuedHandoff(payload, now = Date.now()) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('admission_handoff_invalid');
  }
  if (!ID_PATTERN.test(payload.handoff_id || '')) {
    throw new Error('admission_handoff_invalid');
  }
  let browser;
  try {
    browser = new URL(payload.browser_url);
  } catch {
    throw new Error('admission_handoff_invalid');
  }
  const expiry = Date.parse(payload.expires_at);
  if (
    browser.protocol !== 'https:' ||
    browser.origin !== adjusterNetwork.canonicalOrigin ||
    browser.pathname !== HANDOFF_PATH ||
    browser.search !== '' ||
    !/^#token=[A-Za-z0-9_-]{43,128}$/.test(browser.hash) ||
    !CONFIRMATION_PATTERN.test(payload.confirmation_token || '') ||
    !Number.isFinite(expiry) ||
    expiry <= now
  ) {
    throw new Error('admission_handoff_invalid');
  }
  return {
    handoffId: payload.handoff_id,
    browserUrl: payload.browser_url,
    expiresAt: payload.expires_at,
    confirmationToken: payload.confirmation_token,
  };
}

export function parseAdmissionReturn(params) {
  const result = params?.admission_handoff;
  const handoffId = params?.handoff_id;
  if (
    !ADMISSION_RESULTS.includes(result) ||
    !ID_PATTERN.test(handoffId || '')
  ) {
    return null;
  }
  return { result, handoffId };
}

export async function beginAdmissionHandoff(site) {
  if (!site?.authToken || !site?.clientId) {
    throw new Error('authentication_required');
  }
  const issued = validateIssuedHandoff(
    await site.jsonApi('/native/v1/admission-handoffs', 'POST', {
      return_uri: ADMISSION_RETURN_URI,
    }),
  );
  try {
    const previous = JSON.parse(
      (await AsyncStorage.getItem(ADMISSION_HANDOFF_STORAGE)) || 'null',
    );
    if (previous?.handoffId) confirmationSecrets.delete(previous.handoffId);
  } catch {
    // Invalid non-secret correlation state is replaced below.
  }
  // Persist correlation metadata only. The bearer remains solely in the HTTPS
  // browser URL and is never written to AsyncStorage or diagnostics.
  await AsyncStorage.setItem(
    ADMISSION_HANDOFF_STORAGE,
    JSON.stringify({
      handoffId: issued.handoffId,
      expiresAt: issued.expiresAt,
      siteOrigin: new URL(site.url).origin,
    }),
  );
  // The confirmation bearer is intentionally memory-only. If the process is
  // killed, the flow is interrupted and a new handoff must be issued.
  confirmationSecrets.set(issued.handoffId, issued.confirmationToken);
  try {
    await Linking.openURL(issued.browserUrl);
  } catch (error) {
    confirmationSecrets.delete(issued.handoffId);
    await AsyncStorage.removeItem(ADMISSION_HANDOFF_STORAGE);
    await site
      .jsonApi(
        `/native/v1/admission-handoffs/${encodeURIComponent(
          issued.handoffId,
        )}/interruption`,
        'POST',
      )
      .catch(() => {});
    throw error;
  }
  return { handoffId: issued.handoffId, expiresAt: issued.expiresAt };
}

export async function reconcileAdmissionReturn(site, params) {
  const callback = parseAdmissionReturn(params);
  if (!callback) return { result: 'invalid', admissionComplete: false };

  let pending;
  try {
    pending = JSON.parse(
      (await AsyncStorage.getItem(ADMISSION_HANDOFF_STORAGE)) || 'null',
    );
  } catch {
    pending = null;
  }
  if (
    !pending ||
    pending.handoffId !== callback.handoffId ||
    pending.siteOrigin !== new URL(site.url).origin
  ) {
    return { result: 'invalid', admissionComplete: false };
  }
  if (callback.result === 'confirmation_required') {
    const confirmationToken = confirmationSecrets.get(callback.handoffId);
    if (!confirmationToken) {
      await site
        .jsonApi(
          `/native/v1/admission-handoffs/${encodeURIComponent(
            callback.handoffId,
          )}/interruption`,
          'POST',
        )
        .catch(() => {});
      await AsyncStorage.removeItem(ADMISSION_HANDOFF_STORAGE);
      return { result: 'interrupted', admissionComplete: false };
    }
    const confirmation = await site.jsonApi(
      `/native/v1/admission-handoffs/${encodeURIComponent(
        callback.handoffId,
      )}/confirmation`,
      'POST',
      { confirmation_token: confirmationToken },
    );
    confirmationSecrets.delete(callback.handoffId);
    let finalize;
    try {
      finalize = new URL(confirmation?.finalize_url);
    } catch {
      throw new Error('admission_handoff_invalid');
    }
    if (
      confirmation?.handoff_id !== callback.handoffId ||
      finalize.protocol !== 'https:' ||
      finalize.origin !== adjusterNetwork.canonicalOrigin ||
      finalize.pathname !== FINALIZE_PATH ||
      finalize.searchParams.get('id') !== callback.handoffId ||
      [...finalize.searchParams.keys()].some(key => key !== 'id') ||
      finalize.hash !== ''
    ) {
      throw new Error('admission_handoff_invalid');
    }
    await Linking.openURL(finalize.toString());
    return { result: 'interrupted', admissionComplete: false };
  }

  // The callback is never authoritative. Always ask through the existing
  // UserApiKey session and accept completion only from server state.
  const status = await site.jsonApi(
    `/native/v1/admission-handoffs/${encodeURIComponent(callback.handoffId)}`,
  );
  if (
    status?.handoff_id !== callback.handoffId ||
    !ADMISSION_RESULTS.includes(status?.result)
  ) {
    return { result: 'invalid', admissionComplete: false };
  }
  const terminal = status.result !== 'interrupted';
  if (terminal || status.admission_complete === true) {
    confirmationSecrets.delete(callback.handoffId);
    await AsyncStorage.removeItem(ADMISSION_HANDOFF_STORAGE);
  }
  return {
    result: status.result,
    admissionComplete:
      status.result === 'success' && status.admission_complete === true,
  };
}

export async function reconcilePendingAdmission(site) {
  let pending;
  try {
    pending = JSON.parse(
      (await AsyncStorage.getItem(ADMISSION_HANDOFF_STORAGE)) || 'null',
    );
  } catch {
    return { result: 'invalid', admissionComplete: false };
  }
  if (!pending) return null;
  // Local time never overrides the server. A terminal callback can arrive
  // after the issuance timestamp while the server has already completed the
  // transaction, so status remains authoritative for expiry and completion.
  const status = await site.jsonApi(
    `/native/v1/admission-handoffs/${encodeURIComponent(pending.handoffId)}`,
  );
  const result = status?.result || 'invalid';
  if (result === 'interrupted' && !confirmationSecrets.has(pending.handoffId)) {
    await site
      .jsonApi(
        `/native/v1/admission-handoffs/${encodeURIComponent(
          pending.handoffId,
        )}/interruption`,
        'POST',
      )
      .catch(() => {});
    await AsyncStorage.removeItem(ADMISSION_HANDOFF_STORAGE);
    return { result: 'interrupted', admissionComplete: false };
  }
  if (result !== 'interrupted' || status?.admission_complete === true) {
    await AsyncStorage.removeItem(ADMISSION_HANDOFF_STORAGE);
  }
  return {
    result,
    admissionComplete:
      status?.result === 'success' && status?.admission_complete === true,
  };
}
