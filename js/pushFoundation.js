/* @flow */
'use strict';

import {
  NOTIFICATION_STATUS,
  pushEnvironmentCompatibility,
} from './notificationStatus';
import {
  completedPushRegistration,
  PUSH_HTTP_STATUS_CLASS,
  PUSH_REGISTRATION_CATEGORY,
  PUSH_REGISTRATION_STAGE,
  pushRegistrationFailure,
  resultFromPushError,
  succeededPushRegistrationStage,
} from './pushRegistrationResult';

function boundedPermissionRequest(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('push_permission_request_timeout')),
      timeoutMs,
    );
    Promise.resolve()
      .then(request)
      .then(
        value => {
          clearTimeout(timeout);
          resolve(value);
        },
        error => {
          clearTimeout(timeout);
          reject(error);
        },
      );
  });
}

export class PushFoundation {
  constructor({
    enabled,
    environment,
    apsEnvironment,
    appId,
    appVersion,
    build,
    store,
    transport,
    client,
    onResult = () => {},
    permissionRequestTimeoutMs = 15000,
  }) {
    this.enabled = Boolean(enabled);
    this.environment = environment;
    this.apsEnvironment = apsEnvironment;
    this.appId = appId;
    this.appVersion = appVersion;
    this.build = build;
    this.store = store;
    this.transport = transport;
    this.client = client;
    this.onResult = onResult;
    this.permissionRequestTimeoutMs = permissionRequestTimeoutMs;
    this.account = null;
    this.tokenSubscription = null;
    this.enablePromise = null;
    this.registeredIdentity = null;
    this.lastBackendStatusClass = PUSH_HTTP_STATUS_CLASS.NONE;
    this.retryAfter = 0;
  }

  async status() {
    if (!this.enabled) return 'disabled';
    const compatibility = pushEnvironmentCompatibility(
      this.apsEnvironment,
      this.environment,
    );
    if (compatibility !== 'compatible') return compatibility;
    let preference;
    try {
      preference = await this.store.preference();
    } catch {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.PERMISSION_CHECK,
        PUSH_REGISTRATION_CATEGORY.PREFERENCE_PERSISTENCE_FAILURE,
      );
    }
    if (
      ['enabled', 'denied'].includes(preference) &&
      this.transport.permissionState
    ) {
      let permission;
      try {
        permission = await this.transport.permissionState();
      } catch {
        throw pushRegistrationFailure(
          PUSH_REGISTRATION_STAGE.PERMISSION_CHECK,
          PUSH_REGISTRATION_CATEGORY.PERMISSION_FAILURE,
        );
      }
      if (permission === 'denied') {
        this.emitResult(
          resultFromPushError(
            pushRegistrationFailure(
              PUSH_REGISTRATION_STAGE.PERMISSION_CHECK,
              PUSH_REGISTRATION_CATEGORY.PERMISSION_DENIED,
            ),
          ),
        );
        return NOTIFICATION_STATUS.PERMISSION_DENIED;
      }
      this.emitResult(
        succeededPushRegistrationStage(
          PUSH_REGISTRATION_STAGE.PERMISSION_CHECK,
        ),
      );
    }
    return preference;
  }

  registration(token) {
    return {
      platform: this.transport.platform,
      environment: this.environment,
      appId: this.appId,
      appVersion: this.appVersion,
      build: this.build,
      transportToken: token,
    };
  }

  emitResult(result) {
    try {
      this.onResult(result);
    } catch {
      // Diagnostics must never alter registration behavior.
    }
  }

  async enable(account) {
    if (this.enablePromise) return this.enablePromise;
    this.enablePromise = this._enable(account)
      .then(result => {
        if (result && typeof result === 'object') this.emitResult(result);
        return result;
      })
      .catch(error => {
        this.emitResult(
          resultFromPushError(error, PUSH_REGISTRATION_STAGE.UNKNOWN),
        );
        throw error;
      });
    try {
      return await this.enablePromise;
    } finally {
      this.enablePromise = null;
    }
  }

  async _enable(account) {
    if (!this.enabled) return 'disabled';
    const compatibility = pushEnvironmentCompatibility(
      this.apsEnvironment,
      this.environment,
    );
    if (compatibility !== 'compatible') return compatibility;
    if (Date.now() < this.retryAfter) {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.BACKEND_RESPONSE,
        PUSH_REGISTRATION_CATEGORY.BACKEND_RATE_LIMITED,
        PUSH_HTTP_STATUS_CLASS.RATE_LIMITED,
      );
    }
    let permission;
    try {
      permission = await this.transport.permissionState();
    } catch {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.PERMISSION_CHECK,
        PUSH_REGISTRATION_CATEGORY.PERMISSION_FAILURE,
      );
    }
    if (permission === 'not_determined') {
      try {
        permission = await boundedPermissionRequest(
          () => this.transport.requestPermission(),
          this.permissionRequestTimeoutMs,
        );
      } catch {
        throw pushRegistrationFailure(
          PUSH_REGISTRATION_STAGE.PERMISSION_REQUEST,
          PUSH_REGISTRATION_CATEGORY.PERMISSION_FAILURE,
        );
      }
    }
    if (permission !== 'granted') {
      try {
        await this.store.setPreference('denied');
      } catch {
        throw pushRegistrationFailure(
          PUSH_REGISTRATION_STAGE.PREFERENCE_PERSISTENCE,
          PUSH_REGISTRATION_CATEGORY.PREFERENCE_PERSISTENCE_FAILURE,
        );
      }
      throw pushRegistrationFailure(
        permission === 'denied'
          ? PUSH_REGISTRATION_STAGE.PERMISSION_CHECK
          : PUSH_REGISTRATION_STAGE.PERMISSION_REQUEST,
        PUSH_REGISTRATION_CATEGORY.PERMISSION_DENIED,
      );
    }
    this.emitResult(
      succeededPushRegistrationStage(
        PUSH_REGISTRATION_STAGE.PERMISSION_REQUEST,
      ),
    );
    let token;
    try {
      token = await this.transport.token();
    } catch {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.APNS_TOKEN,
        PUSH_REGISTRATION_CATEGORY.APNS_TOKEN_FAILURE,
      );
    }
    this.emitResult(
      succeededPushRegistrationStage(PUSH_REGISTRATION_STAGE.APNS_TOKEN),
    );
    let installationId;
    try {
      installationId = await this.store.installationId();
    } catch {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.INSTALLATION_IDENTITY,
        PUSH_REGISTRATION_CATEGORY.INSTALLATION_IDENTITY_FAILURE,
      );
    }
    this.emitResult(
      succeededPushRegistrationStage(
        PUSH_REGISTRATION_STAGE.INSTALLATION_IDENTITY,
      ),
    );
    try {
      const identity = `${installationId}:${token}:${account.clientId}`;
      if (this.registeredIdentity !== identity) {
        const httpStatusClass = await this.client.register({
          installationId,
          authToken: account.authToken,
          authClientId: account.clientId,
          registration: this.registration(token),
        });
        this.lastBackendStatusClass =
          httpStatusClass || PUSH_HTTP_STATUS_CLASS.SUCCESS;
        this.registeredIdentity = identity;
        this.emitResult(
          succeededPushRegistrationStage(
            PUSH_REGISTRATION_STAGE.BACKEND_RESPONSE,
            this.lastBackendStatusClass,
          ),
        );
      }
    } catch (error) {
      const result = resultFromPushError(
        error,
        PUSH_REGISTRATION_STAGE.BACKEND_TRANSPORT,
      );
      if (result.category === PUSH_REGISTRATION_CATEGORY.BACKEND_RATE_LIMITED) {
        this.retryAfter = Date.now() + 60 * 1000;
      }
      throw pushRegistrationFailure(
        result.stage,
        result.category,
        result.httpStatusClass,
      );
    }
    this.account = account;
    try {
      await this.store.setPreference('enabled');
    } catch {
      // The backend registration is valid. Keep the in-memory identity so a
      // retry is idempotent, while reporting only the local persistence stage.
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.PREFERENCE_PERSISTENCE,
        PUSH_REGISTRATION_CATEGORY.PREFERENCE_PERSISTENCE_FAILURE,
        this.lastBackendStatusClass || PUSH_HTTP_STATUS_CLASS.SUCCESS,
      );
    }
    this.emitResult(
      succeededPushRegistrationStage(
        PUSH_REGISTRATION_STAGE.PREFERENCE_PERSISTENCE,
        this.lastBackendStatusClass || PUSH_HTTP_STATUS_CLASS.SUCCESS,
      ),
    );
    this.tokenSubscription?.remove?.();
    this.tokenSubscription = this.transport.onTokenRefresh(nextToken =>
      this.rotate(nextToken),
    );
    return completedPushRegistration(
      this.lastBackendStatusClass || PUSH_HTTP_STATUS_CLASS.SUCCESS,
    );
  }

  async rotate(token) {
    if (!this.enabled || !this.account) return false;
    const installationId = await this.store.installationId();
    await this.client.refresh({
      installationId,
      authToken: this.account.authToken,
      authClientId: this.account.clientId,
      registration: this.registration(token),
    });
    return true;
  }

  async setPreference(enabled) {
    if (!this.enabled || !this.account) return false;
    const installationId = await this.store.installationId();
    await this.client.updatePreferences({
      installationId,
      authToken: this.account.authToken,
      authClientId: this.account.clientId,
      enabled,
    });
    await this.store.setPreference(enabled ? 'enabled' : 'denied');
    return true;
  }

  async logout(account) {
    this.tokenSubscription?.remove?.();
    this.tokenSubscription = null;
    this.account = null;
    this.registeredIdentity = null;
    this.retryAfter = 0;
    if (!this.enabled || !account?.authToken) return false;
    const installationId = await this.store.installationId();
    await this.client
      .unregister({
        installationId,
        authToken: account.authToken,
        authClientId: account.clientId,
      })
      .catch(() => {});
    await this.store.setPreference('unknown');
    return true;
  }
}
