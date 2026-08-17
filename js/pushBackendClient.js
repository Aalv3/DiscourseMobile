/* @flow */
'use strict';

import {
  PUSH_HTTP_STATUS_CLASS,
  PUSH_REGISTRATION_CATEGORY,
  PUSH_REGISTRATION_STAGE,
  pushHttpStatusClass,
  pushRegistrationFailure,
} from './pushRegistrationResult';

function endpoint(origin, installationId, suffix = '') {
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw pushRegistrationFailure(
      PUSH_REGISTRATION_STAGE.BACKEND_TRANSPORT,
      PUSH_REGISTRATION_CATEGORY.BACKEND_REJECTION,
    );
  }
  if (
    url.protocol !== 'https:' ||
    !(
      url.hostname === 'adjusternetwork.org' ||
      url.hostname.endsWith('.adjusternetwork.org')
    )
  ) {
    throw pushRegistrationFailure(
      PUSH_REGISTRATION_STAGE.BACKEND_TRANSPORT,
      PUSH_REGISTRATION_CATEGORY.BACKEND_REJECTION,
    );
  }
  return `${url.origin}/native/v1/push/registrations/${encodeURIComponent(
    installationId,
  )}${suffix}`;
}

async function expectSuccess(response) {
  if (!response || response.status < 200 || response.status >= 300) {
    const statusClass = pushHttpStatusClass(response?.status);
    throw pushRegistrationFailure(
      PUSH_REGISTRATION_STAGE.BACKEND_RESPONSE,
      statusClass === PUSH_HTTP_STATUS_CLASS.RATE_LIMITED
        ? PUSH_REGISTRATION_CATEGORY.BACKEND_RATE_LIMITED
        : PUSH_REGISTRATION_CATEGORY.BACKEND_REJECTION,
      statusClass,
    );
  }
  return pushHttpStatusClass(response.status);
}

export class PushBackendClient {
  constructor({ origin, fetchImpl = fetch, nonceFactory }) {
    this.origin = origin;
    this.fetchImpl = fetchImpl;
    this.nonceFactory = nonceFactory;
  }

  async request(url, method, authToken, authClientId, body) {
    let nonce;
    try {
      nonce = await this.nonceFactory?.();
    } catch {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.NONCE_GENERATION,
        PUSH_REGISTRATION_CATEGORY.NONCE_FAILURE,
      );
    }
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(nonce)) {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.NONCE_GENERATION,
        PUSH_REGISTRATION_CATEGORY.NONCE_FAILURE,
      );
    }
    let response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Api-Key': authToken,
          'User-Api-Client-Id': authClientId,
          'X-AN-Push-Nonce': nonce,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.BACKEND_TRANSPORT,
        PUSH_REGISTRATION_CATEGORY.NETWORK_FAILURE,
      );
    }
    return expectSuccess(response);
  }

  register({ installationId, authToken, authClientId, registration }) {
    return this.request(
      endpoint(this.origin, installationId),
      'PUT',
      authToken,
      authClientId,
      {
        registration: {
          platform: registration.platform,
          environment: registration.environment,
          app_id: registration.appId,
          token: registration.transportToken,
        },
      },
    );
  }

  refresh({ installationId, authToken, authClientId, registration }) {
    return this.request(
      endpoint(this.origin, installationId, '/refresh'),
      'POST',
      authToken,
      authClientId,
      { token: registration.transportToken },
    );
  }

  unregister({ installationId, authToken, authClientId }) {
    try {
      return this.request(
        endpoint(this.origin, installationId),
        'DELETE',
        authToken,
        authClientId,
      );
    } catch (error) {
      return Promise.reject(error);
    }
  }

  updatePreferences({ installationId, authToken, authClientId, enabled }) {
    const preferencesUrl = endpoint(this.origin, installationId).replace(
      `/registrations/${encodeURIComponent(installationId)}`,
      '/preferences',
    );
    return this.request(preferencesUrl, 'PUT', authToken, authClientId, {
      enabled: Boolean(enabled),
    });
  }
}
