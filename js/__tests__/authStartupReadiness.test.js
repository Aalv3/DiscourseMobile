/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SiteManager from '../site_manager';
import { credentialStore } from '../secureCredentialStore';

jest.mock('@react-native-community/push-notification-ios', () => ({
  checkPermissions: jest.fn(),
  setApplicationIconBadgeNumber: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native-device-info', () => ({
  getDeviceName: jest.fn().mockResolvedValue('Synthetic Device'),
}));
jest.mock('react-native-key-pair', () => ({}));
jest.mock('@react-native-cookies/cookies', () => ({ clearAll: jest.fn() }));
jest.mock('../secureCredentialStore', () => ({
  credentialStore: {
    readRSAKeys: jest.fn().mockResolvedValue({
      public: 'synthetic-public',
      private: 'synthetic-private',
    }),
    readSiteToken: jest.fn(),
    storeSiteToken: jest.fn().mockResolvedValue(undefined),
  },
}));

const record = () =>
  JSON.stringify([
    {
      url: 'https://adjusternetwork.org',
      apiVersion: 2,
      lastChecked: Date.now(),
      username: 'member',
    },
  ]);

const deferred = () => {
  let resolve;
  const promise = new Promise(next => {
    resolve = next;
  });
  return { promise, resolve };
};

describe('authenticated startup readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockImplementation(key =>
      Promise.resolve(key === '@Discourse.sites' ? null : 'client-id'),
    );
  });

  test('slow storage and Keychain hydration remain explicitly pending', async () => {
    const sites = deferred();
    const token = deferred();
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === '@Discourse.sites') return sites.promise;
      if (key === '@ClientId') return Promise.resolve('client-id');
      return Promise.resolve(null);
    });
    credentialStore.readSiteToken.mockReturnValue(token.promise);

    const manager = new SiteManager();
    const changed = jest.fn();
    manager.subscribe(changed);
    expect(manager.isLoading()).toBe(true);

    sites.resolve(record());
    await Promise.resolve();
    expect(manager.isLoading()).toBe(true);

    token.resolve('restored-token');
    await manager.whenReady();
    expect(manager.isLoading()).toBe(false);
    expect(manager.listSites()[0].authToken).toBe('restored-token');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  test('completed hydration without a credential is signed-out evidence', async () => {
    AsyncStorage.getItem.mockImplementation(key =>
      Promise.resolve(key === '@Discourse.sites' ? record() : 'client-id'),
    );
    credentialStore.readSiteToken.mockResolvedValue(null);
    const manager = new SiteManager();

    await manager.whenReady();
    expect(manager.isLoading()).toBe(false);
    expect(manager.connectedSitesCount()).toBe(0);
  });

  test('root separates restoration, authentication, onboarding, and sign-out', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'Discourse.js'),
      'utf8',
    );
    expect(source).toContain("RESTORING: 'authRestoring'");
    expect(source).toContain("AUTHENTICATED: 'authenticated'");
    expect(source).toContain("SIGNED_OUT: 'signedOut'");
    expect(source).toContain('if (this._siteManager.isLoading())');
    expect(source).toContain('Restoring your secure session…');
    expect(source).toContain('Preparing your member account…');
    expect(source.indexOf('AUTH_STATUS.SIGNED_OUT')).toBeGreaterThan(
      source.indexOf('if (this._siteManager.isLoading())'),
    );
    expect(source).toContain(
      'loadGeneration !== this._onboardingLoadGeneration',
    );
  });

  test('onboarding failure cannot write a signed-out auth state', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'Discourse.js'),
      'utf8',
    );
    const onboarding = source.slice(
      source.indexOf('const localOnboarding = await'),
      source.indexOf('this._siteManager.subscribe'),
    );
    expect(onboarding).toContain('catch');
    expect(onboarding).toContain('AUTH_STATUS.AUTHENTICATED');
    expect(onboarding).not.toContain('AUTH_STATUS.SIGNED_OUT');
  });

  test('server-incomplete onboarding cannot mount guarded member resources', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'Discourse.js'),
      'utf8',
    );
    expect(source).toContain(
      'this.state.onboardingStatus === ONBOARDING_STATUS.COMPLETED &&',
    );
    expect(source).toContain(
      'this.state.onboardingStatus !== ONBOARDING_STATUS.COMPLETED',
    );
    expect(source).not.toContain(
      'this.state.onboardingStatus === ONBOARDING_STATUS.COMPLETED ||',
    );
    expect(source).not.toContain(
      'this.state.onboardingStatus !== ONBOARDING_STATUS.COMPLETED &&\n      !this.state.onboardingDismissedForSession',
    );
  });

  test('completion is revalidated against the canonical server state', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'Discourse.js'),
      'utf8',
    );
    const completion = source.slice(
      source.indexOf('onComplete={state =>'),
      source.indexOf('/>', source.indexOf('onComplete={state =>')),
    );
    expect(completion).toContain('onboardingReady: false');
    expect(completion).toContain('this._productSiteSubscription?.()');
  });
});
