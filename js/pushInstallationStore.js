/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { credentialStore } from './secureCredentialStore';

const INSTALLATION_MARKER = '@AdjusterNetwork.push-installation.v1';
const PREFERENCE_KEY = '@AdjusterNetwork.push-preference.v1';

function secureRandomId() {
  const cryptoApi = global.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('secure_random_unavailable');
  }
  const bytes = new Uint8Array(32);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

export class PushInstallationStore {
  constructor({
    storage = AsyncStorage,
    secureStore = credentialStore,
    idFactory,
  } = {}) {
    this.storage = storage;
    this.secureStore = secureStore;
    this.idFactory = idFactory || secureRandomId;
  }

  async installationId() {
    const marker = await this.storage.getItem(INSTALLATION_MARKER);
    if (!marker) {
      // iOS Keychain entries can survive uninstall. No app marker means a new
      // installation, so discard an orphan before creating the new identity.
      await this.secureStore.removePushInstallationId().catch(() => {});
    }
    let id = marker && (await this.secureStore.readPushInstallationId());
    if (!id) {
      id = this.idFactory();
      await this.secureStore.storePushInstallationId(id);
    }
    await this.storage.setItem(INSTALLATION_MARKER, '1');
    return id;
  }

  async preference() {
    const value = await this.storage.getItem(PREFERENCE_KEY);
    return ['unknown', 'denied', 'enabled'].includes(value) ? value : 'unknown';
  }

  setPreference(value) {
    if (!['unknown', 'denied', 'enabled'].includes(value)) {
      return Promise.reject(new Error('invalid_push_preference'));
    }
    return this.storage.setItem(PREFERENCE_KEY, value);
  }

  async resetForTest() {
    await this.storage.multiRemove([INSTALLATION_MARKER, PREFERENCE_KEY]);
    await this.secureStore.removePushInstallationId();
  }
}

export const pushInstallationStore = new PushInstallationStore();
