/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { credentialStore } from './secureCredentialStore';

const INSTALLATION_MARKER = '@AdjusterNetwork.push-installation.v1';
const PREFERENCE_KEY = '@AdjusterNetwork.push-preference.v1';
const REGISTRATION_IDENTITY_KEY =
  '@AdjusterNetwork.push-registration-identity.v1';

async function secureRandomId() {
  if (Platform.OS === 'ios') {
    const nativeId =
      await NativeModules.DiscourseKeyboardShortcuts?.generateSecureInstallationId?.();
    if (typeof nativeId === 'string' && /^[0-9a-f]{64}$/.test(nativeId)) {
      return nativeId;
    }
    throw new Error('secure_random_unavailable');
  }
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
    this.installationPromise = null;
  }

  installationId() {
    if (this.installationPromise) return this.installationPromise;
    this.installationPromise = this._installationId().finally(() => {
      this.installationPromise = null;
    });
    return this.installationPromise;
  }

  async _installationId() {
    const marker = await this.storage.getItem(INSTALLATION_MARKER);
    if (!marker) {
      // iOS Keychain entries can survive uninstall. No app marker means a new
      // installation, so discard an orphan before creating the new identity.
      await this.secureStore.removePushInstallationId().catch(() => {});
    }
    let id = marker && (await this.secureStore.readPushInstallationId());
    if (!id) {
      id = await this.idFactory();
      await this.secureStore.storePushInstallationId(id);
    }
    await this.storage.setItem(INSTALLATION_MARKER, '1');
    return id;
  }

  requestNonce() {
    return this.idFactory();
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

  registrationIdentity() {
    return this.storage.getItem(REGISTRATION_IDENTITY_KEY);
  }

  setRegistrationIdentity(value) {
    if (value !== null && !/^[0-9a-f]{16}$/.test(value)) {
      return Promise.reject(new Error('invalid_push_registration_identity'));
    }
    return value === null
      ? this.storage.removeItem(REGISTRATION_IDENTITY_KEY)
      : this.storage.setItem(REGISTRATION_IDENTITY_KEY, value);
  }

  async resetForTest() {
    await this.storage.multiRemove([
      INSTALLATION_MARKER,
      PREFERENCE_KEY,
      REGISTRATION_IDENTITY_KEY,
    ]);
    await this.secureStore.removePushInstallationId();
  }
}

export const pushInstallationStore = new PushInstallationStore();
