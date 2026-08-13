/* @flow */
'use strict';

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
  }) {
    this.enabled = Boolean(enabled);
    this.environment = environment;
    this.appId = appId;
    this.appVersion = appVersion;
    this.build = build;
    this.store = store;
    this.transport = transport;
    this.client = client;
    this.account = null;
    this.tokenSubscription = null;
  }

  async status() {
    if (!this.enabled) return 'disabled';
    return this.store.preference();
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

  async enable(account) {
    if (!this.enabled) return 'disabled';
    const permission = await this.transport.requestPermission();
    if (permission !== 'granted') {
      await this.store.setPreference('denied');
      return 'denied';
    }
    let token;
    try {
      token = await this.transport.token();
    } catch {
      throw new Error('push_token_failed');
    }
    let installationId;
    try {
      installationId = await this.store.installationId();
    } catch {
      throw new Error('push_installation_failed');
    }
    try {
      await this.client.register({
        installationId,
        authToken: account.authToken,
        authClientId: account.clientId,
        registration: this.registration(token),
      });
    } catch (error) {
      const safeStatus = /^push_backend_rejected_(?:[1-5][0-9]{2}|transport)$/.test(
        error?.message || '',
      )
        ? error.message
        : 'push_backend_failed';
      throw new Error(safeStatus);
    }
    this.account = account;
    await this.store.setPreference('enabled');
    this.tokenSubscription?.remove?.();
    this.tokenSubscription = this.transport.onTokenRefresh(nextToken =>
      this.rotate(nextToken),
    );
    return 'enabled';
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
