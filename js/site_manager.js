/* @flow */
'use strict';

import { Alert, NativeModules, Platform } from 'react-native';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Site from './site';
import RNKeyPair from 'react-native-key-pair';
import DeviceInfo from 'react-native-device-info';
import JSEncrypt from './../lib/jsencrypt';
import randomBytes from './../lib/random-bytes';
import i18n from 'i18n-js';
import { credentialStore } from './secureCredentialStore';
import { isCanonicalUrl } from './adjusterNetworkSecurity';
import { AUTH_REDIRECT } from './authorizationConsent';
import { adjusterNetwork } from './adjusterNetworkConfig';
import CookieManager from '@react-native-cookies/cookies';
import { consumePendingAuthAttempt } from './authAttempt';
import { requestIOSAuth } from './iosAuthSession';
import {
  parseAuthCallbackParameters,
  parseDecryptedAuthPayload,
} from './authCallback';
import {
  actionableUnreadRows,
  recordNotificationDiagnostic,
  supportedNotification,
} from './notificationState';
import { clearAvatarAuthorityForSite } from './product/avatarAuthority';
import {
  clearAuthorizationProfile,
  markAuthorizationProfileCurrent,
  REQUIRED_AUTHORIZATION_SCOPES,
  validateAuthorizationProfile,
} from './authorizationProfile';
import { requestOrchestrator } from './requestOrchestrator';

const { DiscourseKeyboardShortcuts } = NativeModules;
const REFRESH_THROTTLE_MS = 5000;
// Authenticated GETs the orchestrator may still be caching for a site whose
// credential has just been retired. They must not survive into a fresh
// authorization for the same client id and path.
const RETIRED_CREDENTIAL_CACHE_PATHS = Object.freeze([
  '/native/v1/profile',
  '/native/v1/onboarding',
  '/native/v1/authorization-profile',
]);

class SiteManager {
  lastRefresh = null;
  _subscribers = [];
  sites = [];
  activeSite = null;
  customScheme = 'adjusternetwork';
  urlScheme = AUTH_REDIRECT;
  deviceName = 'Adjuster Network - Unknown Mobile Device';
  hotTopicsHidden = false;
  siteURLsHidden = false;

  constructor() {
    this._readyPromise = this.load();

    AsyncStorage.getItem('@Discourse.lastRefresh').then(date => {
      if (date) {
        this.lastRefresh = new Date(date);
      }
    });

    DeviceInfo.getDeviceName().then(name => {
      this.deviceName = `Adjuster Network - ${name}`;
    });
  }

  setPushFoundation(pushFoundation) {
    this.pushFoundation = pushFoundation;
  }

  exists(site) {
    return this.sites.some(candidate => candidate.url === site.url);
  }

  add(site) {
    if (!isCanonicalUrl(site.url)) {
      return false;
    }
    if (this.exists(site)) {
      return;
    }

    site.createdAt = Date.now();
    this.sites.push(this._adoptSite(site));
    this.save();
    this._onChange();
    this.updateNativeMenu();
    return true;
  }

  getSiteByIndex(index) {
    return this.sites[index];
  }

  async remove(site) {
    let index = this.sites.indexOf(site);
    if (index >= 0) {
      let removableSite = this.sites.splice(index, 1)[0];

      await this.pushFoundation?.logout(removableSite);
      if (removableSite.authToken) {
        await removableSite.revokeApiKey().catch(() => {});
      }
      await credentialStore.removeSiteToken(removableSite.url).catch(() => {});
      await CookieManager.clearAll(true).catch(() => {});
      clearAvatarAuthorityForSite(removableSite);
      removableSite.logoff();
      this.save();
      this._onChange();
    }
    this.updateNativeMenu();
  }

  setActiveSite(site) {
    return new Promise(resolve => {
      if (typeof site === 'string' || site instanceof String) {
        const url = site;
        const activeSite = this.sites.find(s => {
          try {
            return new URL(url).origin === new URL(s.url).origin;
          } catch {
            return false;
          }
        });
        this.activeSite = activeSite || null;
        resolve({ activeSite: activeSite });
      } else {
        this.activeSite = site;
        resolve({ activeSite: site });
        return;
      }
    });
  }

  clearActiveSite() {
    this.activeSite = null;
  }

  updateOrder(data) {
    this.sites = data;
    this.save();
    this.updateNativeMenu();
  }

  updateNativeMenu() {
    if (Platform.OS === 'ios') {
      const siteLabels = this.sites.map(s => s.url.replace(/^https?:\/\//, ''));
      DiscourseKeyboardShortcuts.updateFileMenu(siteLabels);
    }
  }

  subscribe(callback) {
    this._subscribers.push(callback);
  }

  unsubscribe(callback) {
    const pos = this._subscribers.indexOf(callback);
    if (pos >= -1) {
      this._subscribers.splice(pos, 1);
    }
  }

  updateUnreadBadge() {
    const count = this.totalUnread();
    recordNotificationDiagnostic({
      event: 'badge_write',
      reason: 'state_sync',
      outcome: 'requested',
      authoritative: count,
    });
    if (Platform.OS === 'ios') {
      PushNotificationIOS.checkPermissions(p => {
        if (p.badge) {
          PushNotificationIOS.setApplicationIconBadgeNumber(count);
        }
      });
    }
  }

  save() {
    AsyncStorage.setItem('@Discourse.sites', JSON.stringify(this.sites));
  }

  async ensureRSAKeys() {
    if (this.rsaKeys) {
      return;
    }

    let keys = await credentialStore.readRSAKeys();
    if (!keys) {
      const legacyKeys = await AsyncStorage.getItem('@Discourse.rsaKeys');
      if (legacyKeys) {
        keys = JSON.parse(legacyKeys);
      } else {
        keys = await new Promise((resolve, reject) => {
          RNKeyPair.generate(pair => {
            if (pair?.public && pair?.private) {
              resolve(pair);
            } else {
              reject(new Error('rsa_key_generation_failed'));
            }
          });
        });
      }

      await credentialStore.storeRSAKeys(keys);
      if (legacyKeys) {
        await AsyncStorage.removeItem('@Discourse.rsaKeys');
      }
    }

    this.rsaKeys = keys;
  }

  isLoading() {
    return !!this._loading;
  }

  whenReady() {
    return this._readyPromise;
  }

  load() {
    this._loading = true;
    // generate RSA Keys on load, they'll be needed
    this.ensureRSAKeys();

    return AsyncStorage.getItem('@Discourse.sites')
      .then(async json => {
        if (json) {
          const records = JSON.parse(json).filter(record =>
            isCanonicalUrl(record.url),
          );
          const clientId = await this.getClientId();
          this.sites = await Promise.all(
            records.map(async obj => {
              const site = this._adoptSite(new Site(obj));
              // Repair sites saved by older builds that retained the manager
              // client ID but did not serialize it with site metadata.
              site.clientId = site.clientId || clientId;
              if (obj.authToken) {
                await credentialStore.storeSiteToken(site.url, obj.authToken);
              }
              site.authToken = await credentialStore.readSiteToken(site.url);
              recordNotificationDiagnostic({
                event: 'cache_hydrated',
                reason: 'cold_launch',
                outcome: 'preserved',
                authoritative: site.unreadNotifications || 0,
              });
              return site;
            }),
          );
          if (records.some(record => record.authToken)) {
            this.save();
          }

          // Credential hydration is intentionally content-free. The root
          // lifecycle starts notification refresh only after the canonical
          // onboarding contract confirms member-resource access.
        }
      })
      .finally(() => {
        this._loading = false;
        this._onChange();
      });
  }

  totalUnread() {
    let count = 0;
    this.sites.forEach(site => {
      if (site.authToken) {
        count += site.unreadNotifications || 0;
      }
    });
    return count;
  }

  waitFor(duration, check) {
    let start = new Date();

    return new Promise((resolve, reject) => {
      let interval = setInterval(() => {
        if (check()) {
          clearInterval(interval);
          resolve();
          return;
        }
        if (new Date() - start > duration) {
          clearInterval(interval);
          reject();
          return;
        }
      }, 10);
    });
  }

  async refreshSites() {
    const previousRefresh = this.lastRefresh;

    if (!previousRefresh) {
      return this._throttledRefreshSites();
    }

    const lastRun = new Date(previousRefresh).getTime();
    const now = new Date().getTime();

    if (now - lastRun >= REFRESH_THROTTLE_MS) {
      return this._throttledRefreshSites();
    } else {
      console.log('no refresh, it was last refreshed too recently');
      return;
    }
  }

  _throttledRefreshSites() {
    this.lastRefresh = new Date();
    console.log(
      'refreshing ' +
        this.sites.length +
        ' sites at ' +
        this.lastRefresh.toJSON(),
    );

    AsyncStorage.setItem('@Discourse.lastRefresh', this.lastRefresh.toJSON());

    let sites = this.sites.slice(0);
    let promises = [];

    if (sites.length === 0) {
      console.log('no sites defined, nothing to refresh!');
      return;
    }

    return new Promise((resolve, reject) => {
      sites.forEach(site => {
        if (site.authToken) {
          promises.push(site.refresh({ reason: 'foreground' }));
        }
      });

      Promise.all(promises)
        .then(() => this.refreshNotificationState('foreground').catch(() => []))
        .then(() => {
          this.save();
          this._onChange();
          this.updateUnreadBadge();
          resolve();
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  async iOSbackgroundRefresh() {
    const priorBySite = new Map(
      this.sites.map(site => [site, site.unreadNotifications || 0]),
    );
    await Promise.all(
      this.sites.map(site => site.refresh({ reason: 'background' })),
    );
    await this.refreshNotificationState('background').catch(() => []);

    this.sites.forEach(site => {
      if (site.authToken) {
        const prior = priorBySite.get(site) || 0;
        const authoritative = site.unreadNotifications || 0;
        // schedule a local notification for sites with no push capability
        // there is room for improvement here, this currently does not show you
        // a notification if new count is lower than old count (but it might have a
        // new notification nonetheless...)
        if (!site.hasPush && authoritative > prior) {
          PushNotificationIOS.scheduleLocalNotification({
            alertTitle: i18n.t('generic_notification_title', {
              count: authoritative - prior,
            }),
            alertBody: i18n.t('generic_notification_body', {
              url: site.url.replace(/^https?:\/\//, ''),
            }),
            userInfo: { discourse_url: site.url },
          });
        }
      }
    });
    this.updateUnreadBadge();
    this.save();
  }

  serializeParams(obj) {
    return Object.keys(obj)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent([obj[k]])}`)
      .join('&');
  }

  getClientId() {
    return new Promise(resolve => {
      if (this.clientId) {
        resolve(this.clientId);
      } else {
        AsyncStorage.getItem('@ClientId').then(clientId => {
          if (clientId && clientId.length > 0) {
            this.clientId = clientId;
            resolve(clientId);
          } else {
            this.clientId = randomBytes(32);
            AsyncStorage.setItem('@ClientId', this.clientId);
            resolve(this.clientId);
          }
        });
      }
    });
  }

  generateNonce(site) {
    return new Promise(resolve => {
      this._nonce = randomBytes(16);
      this._nonceSite = site;
      resolve(this._nonce);
    });
  }

  decryptHelper(payload) {
    let crypt = new JSEncrypt();
    crypt.setKey(this.rsaKeys.private);
    return crypt.decrypt(payload);
  }

  async handleAuthPayload(payload) {
    // An authorization response is a one-shot capability. Consume the pending
    // state before decrypting so malformed, mismatched, and replayed callbacks
    // all fail closed and require a fresh browser authorization.
    const { site: nonceSite, nonce: expectedNonce } =
      consumePendingAuthAttempt(this);

    const plaintext = this.decryptHelper(payload);
    const decrypted = parseDecryptedAuthPayload(plaintext);
    if (!decrypted) {
      return false;
    }

    if (
      !nonceSite ||
      decrypted.nonce !== expectedNonce ||
      typeof decrypted.key !== 'string' ||
      decrypted.key.length < 1 ||
      decrypted.key.length > 4096
    ) {
      Alert.alert('We were not expecting this reply, please try again!');
      return false;
    }

    const previousToken = nonceSite.authToken;
    const previousHasPush = nonceSite.hasPush;
    const previousApiVersion = nonceSite.apiVersion;
    const retiredBefore = nonceSite.credentialRetired === true;
    const restorePreviousAuthorization = async () => {
      // A credential retired by an authoritative 401 must stay retired. Only
      // restore the prior token when it was still live when this attempt
      // started and nothing retired it while the attempt was in flight.
      const stillRetired =
        retiredBefore || nonceSite.credentialRetired === true;
      nonceSite.hasPush = previousHasPush;
      nonceSite.apiVersion = previousApiVersion;
      if (previousToken && !stillRetired) {
        nonceSite.authToken = previousToken;
        await credentialStore.storeSiteToken(nonceSite.url, previousToken);
      } else {
        nonceSite.authToken = null;
        await credentialStore.removeSiteToken(nonceSite.url);
      }
    };
    nonceSite.authToken = decrypted.key;
    nonceSite.hasPush = decrypted.push;
    nonceSite.apiVersion = decrypted.api;
    let authorizationProfile;
    try {
      authorizationProfile = await nonceSite.jsonApi(
        '/native/v1/authorization-profile',
      );
    } catch {
      await restorePreviousAuthorization();
      return false;
    }
    if (
      !validateAuthorizationProfile(authorizationProfile, nonceSite.clientId)
    ) {
      await restorePreviousAuthorization();
      return false;
    }
    try {
      await credentialStore.storeSiteToken(nonceSite.url, decrypted.key);
      await markAuthorizationProfileCurrent(nonceSite.clientId);
    } catch {
      await restorePreviousAuthorization();
      return false;
    }
    // A verified fresh authorization supersedes any earlier retirement.
    nonceSite.credentialRetired = false;
    nonceSite.credentialRetiredReason = null;
    this.save();

    // cause we want to stop rendering connect
    this._onChange();

    nonceSite
      .refresh()
      .then(() => {
        this._onChange();
      })
      .catch(() => {
        return false;
      });
    return true;
  }

  generateAuthURL(site) {
    if (!site || !isCanonicalUrl(site.url)) {
      return Promise.reject(new Error('auth_origin_not_allowed'));
    }
    let clientId;

    return this.ensureRSAKeys().then(() =>
      this.getClientId()
        .then(cid => {
          clientId = cid;
          // Discourse binds a User API Key to the client_id included in the
          // authorization request. Keep that same identifier on the Site so
          // every authenticated request can send User-Api-Client-Id.
          site.clientId = cid;
          this.save();
          return this.generateNonce(site);
        })
        .then(nonce => {
          // Native member participation uses the supported Discourse
          // POST /posts.json contract. Keep write narrowly scoped within the
          // same User API Key authorization rather than falling back to web
          // cookies or a PWA session. Member discovery is separately scoped
          // and production-authorized so profile search remains read-only.
          const scopes = REQUIRED_AUTHORIZATION_SCOPES.join(',');

          let params = {
            scopes: scopes,
            client_id: clientId,
            nonce: nonce,
            auth_redirect: this.urlScheme,
            application_name: this.deviceName,
            public_key: this.rsaKeys.public,
            discourse_app: 1,
          };

          if (adjusterNetwork.features.push) {
            params.push_url = `https://api.discourse.org/api/publish_${Platform.OS}`;
          }

          return `${site.url}/user-api-key/new?${this.serializeParams(params)}`;
        }),
    );
  }

  generateURLParams(site, type = 'basic') {
    return this.ensureRSAKeys().then(() => {
      let params = {
        auth_redirect: this.urlScheme,
        user_api_public_key: this.rsaKeys.public,
      };

      if (type === 'full') {
        params = {
          auth_redirect: this.urlScheme,
          application_name: this.deviceName,
          public_key: this.rsaKeys.public,
        };
      }

      return this.serializeParams(params);
    });
  }

  async requestAuth(url) {
    const authRequest = await requestIOSAuth(url, this.customScheme, false);
    const urlParams = this.parseURLparameters(authRequest);
    let acceptedPayload = false;

    if (urlParams.payload) {
      acceptedPayload = await this.handleAuthPayload(urlParams.payload);
      if (!acceptedPayload) {
        throw new Error('auth_payload_rejected');
      }
    }

    if (urlParams.oneTimePassword) {
      const OTP = this.decryptHelper(urlParams.oneTimePassword);
      return `${this.activeSite.url}/session/otp/${OTP}`;
    }
    // A payload callback has already completed native authorization. Do not
    // immediately navigate to the site root: the signed-in navigator may not
    // have mounted yet, and the product UI owns the post-login destination.
    return acceptedPayload ? null : this.activeSite.url;
  }

  parseURLparameters(string) {
    return parseAuthCallbackParameters(string);
  }

  getSeenNotificationMap() {
    return new Promise(resolve => {
      let promises = [];
      let results = {};

      this.sites.forEach(site => {
        if (site.authToken) {
          promises.push(
            site.getSeenNotificationId().then(function (id) {
              results[site.url] = id;
            }),
          );
        }
      });

      Promise.all(promises).then(() => resolve(results));
    });
  }

  notifications(types, options) {
    return new Promise((resolve, reject) => {
      let promises = [];
      this.sites.forEach(site => {
        let opts = options;

        if (opts?.onlyNew) {
          opts = { ...opts, onlyUnread: true };
        }

        let promise = site.notifications(types, opts).then(notifications => {
          return notifications.map(n => {
            return { notification: n, site: site };
          });
        });

        promises.push(promise);
      });

      Promise.all(promises)
        .then(async results => {
          const ordered = results
            .flat()
            .filter(row => supportedNotification(row.notification))
            .sort((left, right) => {
              const leftPriority =
                !left.notification.read &&
                left.notification.notification_type === 6
                  ? 0
                  : 1;
              const rightPriority =
                !right.notification.read &&
                right.notification.notification_type === 6
                  ? 0
                  : 1;
              if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority;
              }
              return String(right.notification.created_at).localeCompare(
                String(left.notification.created_at),
              );
            });
          // The native snapshot is already Guardian-filtered on the server.
          // Never probe each topic or mutate rows merely to discover access.
          const available = ordered;
          if (options?.onlyNew || options?.authoritative) {
            const actionableRows = actionableUnreadRows(available);
            const actionableBySite = new Map();
            actionableRows.forEach(row => {
              actionableBySite.set(
                row.site,
                (actionableBySite.get(row.site) || 0) + 1,
              );
            });
            let countersChanged = false;
            this.sites.forEach(site => {
              if (!site.authToken) return;
              const actionable = Number.isFinite(
                site._authoritativeNotificationCount,
              )
                ? site._authoritativeNotificationCount
                : actionableBySite.get(site) || 0;
              if (site.unreadNotifications !== actionable) {
                const prior = site.unreadNotifications || 0;
                site.unreadNotifications = actionable;
                countersChanged = true;
                recordNotificationDiagnostic({
                  event: 'authoritative_transition',
                  reason: options?.reason || 'list_refresh',
                  outcome: 'applied',
                  prior,
                  result: available.length,
                  authoritative: actionable,
                });
              }
            });
            if (countersChanged) {
              this.save();
              this._onChange();
              this.updateUnreadBadge();
            }
          }
          resolve(available);
        })
        .catch(reject);
    });
  }

  refreshNotificationState(reason = 'manual') {
    if (this._notificationRefresh) return this._notificationRefresh;
    const prior = this.totalUnread();
    const request = this.notifications(undefined, {
      authoritative: true,
      reason,
      silent: false,
      surfaceErrors: true,
    })
      .then(rows => {
        recordNotificationDiagnostic({
          event: 'list_refresh',
          reason,
          outcome: 'succeeded',
          status: '2xx',
          prior,
          result: rows.length,
          authoritative: this.totalUnread(),
        });
        return rows;
      })
      .catch(error => {
        recordNotificationDiagnostic({
          event: 'list_refresh',
          reason,
          outcome: 'preserved',
          status: error?.status || 'network',
          prior,
          authoritative: this.totalUnread(),
        });
        throw error;
      })
      .finally(() => {
        if (this._notificationRefresh === request) {
          this._notificationRefresh = null;
        }
      });
    this._notificationRefresh = request;
    return request;
  }

  async markNotificationRead(site, notification) {
    const prior = this.totalUnread();
    const wasUnread = !notification.read;
    await site.readNotification(notification);
    const next = wasUnread
      ? Math.max(0, (site.unreadNotifications || 0) - 1)
      : site.unreadNotifications || 0;
    notification.read = true;
    site.unreadNotifications = next;
    this.save();
    this._onChange();
    this.updateUnreadBadge();
    recordNotificationDiagnostic({
      event: 'read_transition',
      reason: 'notification_open',
      outcome: 'applied',
      prior,
      authoritative: this.totalUnread(),
    });
  }

  listSites() {
    return this.sites;
  }

  connectedSitesCount() {
    return this.sites.filter(site => site.authToken).length;
  }

  _onChange() {
    this._subscribers.forEach(sub => sub({ event: 'change' }));
  }

  // Only an authoritative 401 reaches this path. Ordinary 403 authorization
  // limits, onboarding/policy gating, 429 cooldowns, offline failures and 5xx
  // errors all preserve the session by design and must never retire a
  // credential.
  _adoptSite(site) {
    site.onCredentialRetired = retiredSite =>
      this._handleCredentialRetired(retiredSite);
    return site;
  }

  async _handleCredentialRetired(site) {
    if (!site) return;
    // Persist first so a relaunch cannot rehydrate the dead token, then drop
    // every authenticated artifact tied to it, then let the root navigator
    // re-evaluate and fall back to the signed-out welcome screen.
    this.save();
    await credentialStore.removeSiteToken(site.url).catch(() => {});
    await clearAuthorizationProfile(site.clientId).catch(() => {});
    clearAvatarAuthorityForSite(site);
    requestOrchestrator.invalidate(
      RETIRED_CREDENTIAL_CACHE_PATHS.map(path => site.apiRequestKey(path)),
    );
    this.updateUnreadBadge();
    this._onChange();
  }

  storeLastPath(navState) {
    let shouldSave = false;

    if (this.activeSite) {
      this.sites.forEach(site => {
        if (site === this.activeSite) {
          const currentUrl =
            navState.url && navState.url.endsWith('/')
              ? navState.url.slice(0, -1)
              : navState.url;

          if (currentUrl === site.url) {
            site.lastVisitedPath = null;
            site.lastVisitedPathAt = null;
          } else {
            site.lastVisitedPath = currentUrl.replace(site.url, '');
            site.lastVisitedPathAt = new Date().getTime();
          }
          shouldSave = true;
        }
      });

      if (shouldSave) {
        this.save();
      }
    }
  }

  async refreshActiveSite() {
    if (!this.activeSite) {
      return;
    }
    await this.activeSite.refresh();
    this._onChange();
    this.updateUnreadBadge();
    this.activeSite = null;
  }

  urlInSites(url) {
    if (!isCanonicalUrl(url)) {
      return false;
    }
    return this.sites.some(site => {
      try {
        return new URL(url).origin === new URL(site.url).origin;
      } catch {
        return false;
      }
    });
  }
}

export default SiteManager;
