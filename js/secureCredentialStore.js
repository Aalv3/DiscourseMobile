/* @flow */
'use strict';

import * as Keychain from 'react-native-keychain';

const USERNAME = 'adjuster-network';
const RSA_SERVICE = 'org.adjusternetwork.native.rsa.v1';
const PUSH_INSTALLATION_SERVICE =
  'org.adjusternetwork.native.push-installation.v1';

function originKey(origin) {
  let hash = 5381;
  for (let index = 0; index < origin.length; index += 1) {
    hash = (hash * 33) ^ origin.charCodeAt(index);
  }
  return `org.adjusternetwork.native.token.v1.${(hash >>> 0).toString(16)}`;
}

const options = service => ({
  service,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

async function store(service, value) {
  await Keychain.setGenericPassword(USERNAME, value, options(service));
}

async function read(service) {
  const result = await Keychain.getGenericPassword(options(service));
  return result ? result.password : null;
}

async function remove(service) {
  await Keychain.resetGenericPassword(options(service));
}

export const credentialStore = Object.freeze({
  storeSiteToken(origin, token) {
    return store(originKey(origin), token);
  },
  readSiteToken(origin) {
    return read(originKey(origin));
  },
  removeSiteToken(origin) {
    return remove(originKey(origin));
  },
  storeRSAKeys(keys) {
    return store(RSA_SERVICE, JSON.stringify(keys));
  },
  async readRSAKeys() {
    const value = await read(RSA_SERVICE);
    return value ? JSON.parse(value) : null;
  },
  removeRSAKeys() {
    return remove(RSA_SERVICE);
  },
  storePushInstallationId(installationId) {
    return store(PUSH_INSTALLATION_SERVICE, installationId);
  },
  readPushInstallationId() {
    return read(PUSH_INSTALLATION_SERVICE);
  },
  removePushInstallationId() {
    return remove(PUSH_INSTALLATION_SERVICE);
  },
});
