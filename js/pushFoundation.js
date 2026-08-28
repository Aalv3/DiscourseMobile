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
  startedPushRegistration,
  succeededPushRegistrationStage,
} from './pushRegistrationResult';
import {
  boundedPushOperation,
  PUSH_OPERATION_TIMEOUT_MS,
} from './pushBoundedOperation';

export class PushFoundation {
  constructor({
    enabled,
    environment,
    appId,
    appVersion,
    build,
    store,
    transport,
    client,
    onResult = () => {},
    permissionCheckTimeoutMs = PUSH_OPERATION_TIMEOUT_MS.AUTHORIZATION,
    permissionRequestTimeoutMs = PUSH_OPERATION_TIMEOUT_MS.AUTHORIZATION,
    installationTimeoutMs = PUSH_OPERATION_TIMEOUT_MS.INSTALLATION_IDENTITY,
    preferenceTimeoutMs = PUSH_OPERATION_TIMEOUT_MS.PREFERENCE_PERSISTENCE,
    refreshTimeoutMs = PUSH_OPERATION_TIMEOUT_MS.TOKEN_REFRESH,
  }) {
    this.enabled = Boolean(enabled);
    this.environment = environment;
    this.appId = appId;
    this.appVersion = appVersion;
    this.build = build;
    this.store = store;
    this.transport = transport;
    this.client = client;
    this.onResult = onResult;
    this.permissionCheckTimeoutMs = permissionCheckTimeoutMs;
    this.permissionRequestTimeoutMs = permissionRequestTimeoutMs;
    this.installationTimeoutMs = installationTimeoutMs;
    this.preferenceTimeoutMs = preferenceTimeoutMs;
    this.refreshTimeoutMs = refreshTimeoutMs;
    this.account = null;
    this.tokenSubscription = null;
    this.enablePromise = null;
    this.registeredIdentity = null;
    this.lastBackendStatusClass = PUSH_HTTP_STATUS_CLASS.NONE;
    this.retryAfter = 0;
    this.refreshPromise = null;
    this.pendingRefreshToken = null;
    this.lastPermissionState = 'unknown';
    this.lastPersistedPreference = 'unknown';
  }

  async status() {
    if (!this.enabled) return 'disabled';
    const compatibility = pushEnvironmentCompatibility(this.environment);
    if (compatibility !== 'compatible') return compatibility;
    let preference;
    try {
      preference = await boundedPushOperation(() => this.store.preference(), {
        timeoutMs: this.preferenceTimeoutMs,
        timeoutCode: 'push_preference_read_timeout',
      });
    } catch {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.PREFERENCE_PERSISTENCE,
        PUSH_REGISTRATION_CATEGORY.PREFERENCE_PERSISTENCE_FAILURE,
      );
    }
    this.lastPersistedPreference = preference;
    if (
      ['enabled', 'denied'].includes(preference) &&
      this.transport.permissionState
    ) {
      let permission;
      this.emitResult(
        startedPushRegistration(PUSH_REGISTRATION_STAGE.PERMISSION_CHECK),
      );
      try {
        permission = await boundedPushOperation(
          () => this.transport.permissionState(),
          {
            timeoutMs: this.permissionCheckTimeoutMs,
            timeoutCode: 'push_permission_check_timeout',
          },
        );
      } catch {
        throw pushRegistrationFailure(
          PUSH_REGISTRATION_STAGE.PERMISSION_CHECK,
          PUSH_REGISTRATION_CATEGORY.PERMISSION_FAILURE,
        );
      }
      this.lastPermissionState = permission;
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

  diagnosticState() {
    return {
      permission: this.lastPermissionState,
      preference: this.lastPersistedPreference,
      backend:
        this.lastBackendStatusClass === PUSH_HTTP_STATUS_CLASS.SUCCESS
          ? 'confirmed'
          : this.lastPersistedPreference === 'enabled'
          ? 'last_known_enabled'
          : 'unknown',
    };
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

  registrationIdentity(installationId, token, account) {
    const input = [
      installationId,
      token,
      account.clientId,
      this.transport.platform,
      this.environment,
      this.appId,
      this.appVersion,
      this.build,
    ].join('\u0000');
    // Persist only a bounded one-way fingerprint. APNs tokens, credentials and
    // installation identifiers never enter AsyncStorage.
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index);
      first = Math.imul(first ^ code, 0x01000193) >>> 0;
      second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
    }
    return `${first.toString(16).padStart(8, '0')}${second
      .toString(16)
      .padStart(8, '0')}`;
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
    const compatibility = pushEnvironmentCompatibility(this.environment);
    if (compatibility !== 'compatible') return compatibility;
    if (Date.now() < this.retryAfter) {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.BACKEND_RESPONSE,
        PUSH_REGISTRATION_CATEGORY.BACKEND_RATE_LIMITED,
        PUSH_HTTP_STATUS_CLASS.RATE_LIMITED,
      );
    }
    let permission;
    this.emitResult(
      startedPushRegistration(PUSH_REGISTRATION_STAGE.PERMISSION_CHECK),
    );
    try {
      permission = await boundedPushOperation(
        () => this.transport.permissionState(),
        {
          timeoutMs: this.permissionCheckTimeoutMs,
          timeoutCode: 'push_permission_check_timeout',
        },
      );
    } catch {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.PERMISSION_CHECK,
        PUSH_REGISTRATION_CATEGORY.PERMISSION_FAILURE,
      );
    }
    this.lastPermissionState = permission;
    this.emitResult(
      succeededPushRegistrationStage(PUSH_REGISTRATION_STAGE.PERMISSION_CHECK),
    );
    let requestedPermission = false;
    if (permission === 'not_determined') {
      requestedPermission = true;
      this.emitResult(
        startedPushRegistration(PUSH_REGISTRATION_STAGE.PERMISSION_REQUEST),
      );
      try {
        permission = await boundedPushOperation(
          () => this.transport.requestPermission(),
          {
            timeoutMs: this.permissionRequestTimeoutMs,
            timeoutCode: 'push_permission_request_timeout',
          },
        );
      } catch {
        throw pushRegistrationFailure(
          PUSH_REGISTRATION_STAGE.PERMISSION_REQUEST,
          PUSH_REGISTRATION_CATEGORY.PERMISSION_FAILURE,
        );
      }
      this.lastPermissionState = permission;
      this.emitResult(
        succeededPushRegistrationStage(
          PUSH_REGISTRATION_STAGE.PERMISSION_REQUEST,
        ),
      );
    }
    if (permission !== 'granted') {
      try {
        await boundedPushOperation(() => this.store.setPreference('denied'), {
          timeoutMs: this.preferenceTimeoutMs,
          timeoutCode: 'push_preference_write_timeout',
        });
        this.lastPersistedPreference = 'denied';
      } catch {
        throw pushRegistrationFailure(
          PUSH_REGISTRATION_STAGE.PREFERENCE_PERSISTENCE,
          PUSH_REGISTRATION_CATEGORY.PREFERENCE_PERSISTENCE_FAILURE,
        );
      }
      throw pushRegistrationFailure(
        requestedPermission
          ? PUSH_REGISTRATION_STAGE.PERMISSION_REQUEST
          : PUSH_REGISTRATION_STAGE.PERMISSION_CHECK,
        permission === 'denied'
          ? PUSH_REGISTRATION_CATEGORY.PERMISSION_DENIED
          : PUSH_REGISTRATION_CATEGORY.PERMISSION_FAILURE,
      );
    }
    let token;
    this.emitResult(
      startedPushRegistration(PUSH_REGISTRATION_STAGE.APNS_TOKEN),
    );
    try {
      token = await boundedPushOperation(() => this.transport.token(), {
        timeoutMs: PUSH_OPERATION_TIMEOUT_MS.APNS_TOKEN,
        timeoutCode: 'push_token_timeout',
      });
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
    this.emitResult(
      startedPushRegistration(PUSH_REGISTRATION_STAGE.INSTALLATION_IDENTITY),
    );
    try {
      installationId = await boundedPushOperation(
        () => this.store.installationId(),
        {
          timeoutMs: this.installationTimeoutMs,
          timeoutCode: 'push_installation_identity_timeout',
        },
      );
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
      const identity = this.registrationIdentity(
        installationId,
        token,
        account,
      );
      const persistedIdentity = await this.store.registrationIdentity?.();
      if (
        this.registeredIdentity !== identity &&
        persistedIdentity !== identity
      ) {
        const httpStatusClass = await this.client.register({
          installationId,
          authToken: account.authToken,
          authClientId: account.clientId,
          registration: this.registration(token),
          onStage: result => this.emitResult(result),
        });
        this.lastBackendStatusClass =
          httpStatusClass || PUSH_HTTP_STATUS_CLASS.SUCCESS;
        this.registeredIdentity = identity;
        await this.store.setRegistrationIdentity?.(identity);
        this.emitResult(
          succeededPushRegistrationStage(
            PUSH_REGISTRATION_STAGE.BACKEND_RESPONSE,
            this.lastBackendStatusClass,
          ),
        );
      }
      this.registeredIdentity = identity;
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
    this.emitResult(
      startedPushRegistration(PUSH_REGISTRATION_STAGE.PREFERENCE_PERSISTENCE),
    );
    try {
      await boundedPushOperation(() => this.store.setPreference('enabled'), {
        timeoutMs: this.preferenceTimeoutMs,
        timeoutCode: 'push_preference_write_timeout',
      });
      this.lastPersistedPreference = 'enabled';
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
    this.tokenSubscription = this.transport.onTokenRefresh(nextToken => {
      this.scheduleTokenRefresh(nextToken);
    });
    return completedPushRegistration(
      this.lastBackendStatusClass || PUSH_HTTP_STATUS_CLASS.SUCCESS,
    );
  }

  async rotate(token) {
    if (!this.enabled || !this.account) return false;
    let installationId;
    this.emitResult(
      startedPushRegistration(PUSH_REGISTRATION_STAGE.INSTALLATION_IDENTITY),
    );
    try {
      installationId = await boundedPushOperation(
        () => this.store.installationId(),
        {
          timeoutMs: this.installationTimeoutMs,
          timeoutCode: 'push_installation_identity_timeout',
        },
      );
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
      const httpStatusClass = await boundedPushOperation(
        () =>
          this.client.refresh({
            installationId,
            authToken: this.account.authToken,
            authClientId: this.account.clientId,
            registration: this.registration(token),
            onStage: result => this.emitResult(result),
          }),
        {
          timeoutMs: this.refreshTimeoutMs,
          timeoutCode: 'push_refresh_timeout',
        },
      );
      this.emitResult(
        succeededPushRegistrationStage(
          PUSH_REGISTRATION_STAGE.BACKEND_RESPONSE,
          httpStatusClass || PUSH_HTTP_STATUS_CLASS.SUCCESS,
        ),
      );
      return true;
    } catch (error) {
      if (error?.message === 'push_refresh_timeout') {
        throw pushRegistrationFailure(
          PUSH_REGISTRATION_STAGE.BACKEND_TRANSPORT,
          PUSH_REGISTRATION_CATEGORY.NETWORK_FAILURE,
        );
      }
      const result = resultFromPushError(
        error,
        PUSH_REGISTRATION_STAGE.BACKEND_TRANSPORT,
      );
      throw pushRegistrationFailure(
        result.stage,
        result.category,
        result.httpStatusClass,
      );
    }
  }

  scheduleTokenRefresh(token) {
    this.pendingRefreshToken = token;
    if (this.refreshPromise) return;
    this.refreshPromise = (async () => {
      while (this.pendingRefreshToken) {
        const nextToken = this.pendingRefreshToken;
        this.pendingRefreshToken = null;
        try {
          await this.rotate(nextToken);
        } catch (error) {
          const result = resultFromPushError(
            error,
            PUSH_REGISTRATION_STAGE.BACKEND_TRANSPORT,
          );
          if (
            result.category === PUSH_REGISTRATION_CATEGORY.BACKEND_RATE_LIMITED
          ) {
            this.retryAfter = Date.now() + 60 * 1000;
          }
          this.emitResult(result);
        }
      }
    })().finally(() => {
      this.refreshPromise = null;
      if (this.pendingRefreshToken) {
        this.scheduleTokenRefresh(this.pendingRefreshToken);
      }
    });
  }

  async setPreference(enabled) {
    if (!this.enabled || !this.account) return false;
    let installationId;
    try {
      installationId = await boundedPushOperation(
        () => this.store.installationId(),
        {
          timeoutMs: this.installationTimeoutMs,
          timeoutCode: 'push_installation_identity_timeout',
        },
      );
    } catch {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.INSTALLATION_IDENTITY,
        PUSH_REGISTRATION_CATEGORY.INSTALLATION_IDENTITY_FAILURE,
      );
    }
    await this.client.updatePreferences({
      installationId,
      authToken: this.account.authToken,
      authClientId: this.account.clientId,
      enabled,
    });
    try {
      await boundedPushOperation(
        () => this.store.setPreference(enabled ? 'enabled' : 'denied'),
        {
          timeoutMs: this.preferenceTimeoutMs,
          timeoutCode: 'push_preference_write_timeout',
        },
      );
      this.lastPersistedPreference = enabled ? 'enabled' : 'denied';
    } catch {
      throw pushRegistrationFailure(
        PUSH_REGISTRATION_STAGE.PREFERENCE_PERSISTENCE,
        PUSH_REGISTRATION_CATEGORY.PREFERENCE_PERSISTENCE_FAILURE,
      );
    }
    return true;
  }

  async logout(account) {
    this.tokenSubscription?.remove?.();
    this.tokenSubscription = null;
    this.account = null;
    this.registeredIdentity = null;
    this.retryAfter = 0;
    if (!this.enabled || !account?.authToken) return false;
    let installationId;
    try {
      installationId = await boundedPushOperation(
        () => this.store.installationId(),
        {
          timeoutMs: this.installationTimeoutMs,
          timeoutCode: 'push_installation_identity_timeout',
        },
      );
    } catch {
      return false;
    }
    await this.client
      .unregister({
        installationId,
        authToken: account.authToken,
        authClientId: account.clientId,
      })
      .catch(() => {});
    await boundedPushOperation(() => this.store.setPreference('unknown'), {
      timeoutMs: this.preferenceTimeoutMs,
      timeoutCode: 'push_preference_write_timeout',
    }).catch(() => {});
    await Promise.resolve(this.store.setRegistrationIdentity?.(null)).catch(
      () => {},
    );
    this.lastPersistedPreference = 'unknown';
    return true;
  }
}
