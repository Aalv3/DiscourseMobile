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
    throw new Error('push_backend_rejected');
  }
}

export class PushBackendClient {
  constructor({ origin, fetchImpl = fetch }) {
    this.origin = origin;
    this.fetchImpl = fetchImpl;
  }

  request(url, method, authToken, body) {
    return this.fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Api-Key': authToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(expectSuccess);
  }

  register({ installationId, authToken, registration }) {
    return this.request(
      endpoint(this.origin, installationId),
      'PUT',
      authToken,
      registration,
    );
  }

  refresh({ installationId, authToken, registration }) {
    return this.request(
      endpoint(this.origin, installationId, '/refresh'),
      'POST',
      authToken,
      registration,
    );
  }

  unregister({ installationId, authToken }) {
    try {
      return this.request(
        endpoint(this.origin, installationId),
        'DELETE',
        authToken,
      );
    } catch (error) {
      return Promise.reject(error);
    }
  }

  updatePreferences({ installationId, authToken, enabled }) {
    const preferencesUrl = endpoint(this.origin, installationId).replace(
      `/registrations/${encodeURIComponent(installationId)}`,
      '/preferences',
    );
    return this.request(preferencesUrl, 'PUT', authToken, {
      installationId,
      enabled: Boolean(enabled),
    });
  }
}
