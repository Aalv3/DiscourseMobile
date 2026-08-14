/* @flow */
'use strict';

function endpoint(origin, installationId, suffix = '') {
  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new Error('push_backend_unconfigured');
  }
  if (
    url.protocol !== 'https:' ||
    !(
      url.hostname === 'adjusternetwork.org' ||
      url.hostname.endsWith('.adjusternetwork.org')
    )
  ) {
    throw new Error('push_backend_unconfigured');
  }
  return `${url.origin}/native/v1/push/registrations/${encodeURIComponent(
    installationId,
  )}${suffix}`;
}

async function expectSuccess(response) {
  if (!response || response.status < 200 || response.status >= 300) {
    const status = Number.isInteger(response?.status)
      ? response.status
      : 'transport';
    throw new Error(`push_backend_rejected_${status}`);
  }
}

export class PushBackendClient {
  constructor({ origin, fetchImpl = fetch, nonceFactory }) {
    this.origin = origin;
    this.fetchImpl = fetchImpl;
    this.nonceFactory = nonceFactory;
  }

  async request(url, method, authToken, authClientId, body) {
    const nonce = await this.nonceFactory?.();
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(nonce)) {
      throw new Error('push_backend_nonce_unavailable');
    }
    return this.fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Api-Key': authToken,
        'User-Api-Client-Id': authClientId,
        'X-AN-Push-Nonce': nonce,
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(expectSuccess);
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
