/* @flow */
'use strict';

import { Platform } from 'react-native';
import _ from 'lodash';
import fetch from './../lib/fetch';
import { isCanonicalUrl } from './adjusterNetworkSecurity';
import { credentialStore } from './secureCredentialStore';
import { classifyAuthResponse } from './authResponsePolicy';
import { RATE_LIMIT_MAX_RETRIES } from './apiRateLimit';
import { limiterBucket, requestOrchestrator } from './requestOrchestrator';
import { recordNotificationDiagnostic } from './notificationState';

class Site {
  static discoverUrl() {
    return 'https://discover.discourse.com/';
  }

  static FIELDS = [
    'apiVersion',
    'authToken',
    'chatNotifications',
    'clientId',
    'createdAt',
    'description',
    'flagCount',
    'hasChatEnabled',
    'hasPush',
    'icon',
    'isStaff',
    'lastChecked',
    'lastVisitedPath',
    'lastVisitedPathAt',
    'loginRequired',
    'queueCount',
    'title',
    'totalNew',
    'totalUnread',
    'unreadNotifications',
    'unreadPrivateMessages',
    'url',
    'username',
  ];

  static fromTerm(term) {
    let url = '';

    term = term.trim();
    while (term.endsWith('/')) {
      term = term.slice(0, term.length - 1);
    }

    if (!term.match(/^https:\/\//)) {
      url = `https://${term}`;
    } else {
      url = term;
    }

    return isCanonicalUrl(url) ? Site.fromURL(url) : Promise.resolve(false);
  }

  static fromURL(url) {
    let req = new Request(`${url}/user-api-key/new`, {
      method: 'HEAD',
    });

    let apiVersion;

    return fetch(req)
      .then(userApiKeyResponse => {
        if (userApiKeyResponse.status === 404) {
          throw 'bad api';
        }

        if (userApiKeyResponse.status !== 200) {
          throw 'bad url';
        }

        let version = userApiKeyResponse.headers.get('Auth-Api-Version');
        apiVersion = parseInt(version, 10);
        if (apiVersion < 2) {
          throw 'bad api';
        }

        // make sure we use the correct URL, eg: a URL could lead us to
        // the correct destination after a redirect, we want to store the
        // final destination and not the origin
        // we also replace any trailing slash
        url = userApiKeyResponse.url
          .replace('/user-api-key/new', '')
          .replace(/\/+$/, '')
          .replace(/:\d+/, '');

        if (!isCanonicalUrl(url)) {
          throw 'redirect_not_allowed';
        }

        return fetch(`${url}/site/basic-info.json`).then(basicInfoResponse =>
          basicInfoResponse.json(),
        );
      })
      .then(info => {
        const siteInfo = {
          url: url,
          title: info.title,
          description: info.description,
          icon: info.apple_touch_icon_url,
          apiVersion: apiVersion,
          loginRequired: false,
        };

        if ('login_required' in info) {
          siteInfo.loginRequired = info.login_required;
        }

        return new Site(siteInfo);
      })
      .catch(() => {
        return false;
      });
  }

  constructor(props) {
    if (props) {
      Site.FIELDS.forEach(prop => {
        this[prop] = props[prop];
      });

      if (this.icon) {
        this.icon = this.addHttps(this.icon);
      }
    }
    this._timeout = 10000;
  }

  addHttps(url) {
    if (!/^(f|ht)tps?:/i.test(url)) {
      url = 'https:' + url;
    }
    return url;
  }

  jsonApi(path, method, data) {
    const normalizedMethod = method || 'GET';
    const key = this.apiRequestKey(path, normalizedMethod);
    const ttlMs =
      normalizedMethod === 'GET' && path.startsWith('/native/v1/') ? 30000 : 0;
    return requestOrchestrator.request({
      key,
      ttlMs,
      allowStale: normalizedMethod === 'GET' && path.startsWith('/native/v1/'),
      priority: normalizedMethod === 'GET' ? 'visible' : 'bootstrap',
      task: () => this._jsonApi(path, normalizedMethod, data),
    });
  }

  apiRequestKey(path, method = 'GET') {
    return `${this.url}:${this.clientId || ''}:${method}:${path}`;
  }

  invalidateApiCache(paths) {
    requestOrchestrator.invalidate(
      paths.map(path => this.apiRequestKey(path, 'GET')),
    );
  }

  async _jsonApi(path, method, data) {
    method = method || 'GET';
    let headers = {
      'User-Api-Key': this.authToken,
      'User-Agent': `Discourse ${Platform.OS} App / 1.0`,
      'Content-Type': 'application/json',
      'Dont-Chunk': 'true',
      'User-Api-Client-Id': this.clientId || '',
    };

    if (data) {
      data = JSON.stringify(data);
    }

    for (let retryIndex = 0; ; retryIndex += 1) {
      const fallbackBucket = limiterBucket({
        origin: this.url,
        clientId: this.clientId,
        path,
        errorCode: null,
      });
      const globalUserBucket = limiterBucket({
        origin: this.url,
        clientId: this.clientId,
        path,
        errorCode: 'user_api_key_limiter_60_secs',
      });
      await requestOrchestrator.waitForBucket(globalUserBucket);
      await requestOrchestrator.waitForBucket(fallbackBucket);
      let req = new Request(this.url + path, {
        headers: headers,
        method: method,
        body: data,
      });
      const activeFetch = fetch(req);
      this._currentFetch = activeFetch;
      try {
        const r1 = await activeFetch;
        if (r1.status >= 200 && r1.status < 300) {
          return method === 'DELETE' || r1.status === 204 || r1.status === 205
            ? null
            : r1.json();
        } else if (r1.status === 429) {
          const errorCode = r1.headers?.get?.(
            'Discourse-Rate-Limit-Error-Code',
          );
          const bucket = limiterBucket({
            origin: this.url,
            clientId: this.clientId,
            path,
            errorCode,
          });
          const retryAfterMs = requestOrchestrator.beginCooldown(
            bucket,
            r1,
            retryIndex,
          );
          if (retryIndex < RATE_LIMIT_MAX_RETRIES) {
            await requestOrchestrator.admitRetry(bucket);
            continue;
          }
          const error = new Error('api_rate_limited');
          error.status = 429;
          error.retryAfterMs = retryAfterMs;
          error.rateLimitCode = errorCode || null;
          throw error;
        } else if (classifyAuthResponse(r1.status) === 'revoked') {
          this.logoff();
          credentialStore.removeSiteToken(this.url).catch(() => {});
          const error = new Error('auth_revoked');
          error.status = r1.status;
          throw error;
        } else if (classifyAuthResponse(r1.status) === 'forbidden') {
          // A valid, narrowly scoped user API key can be forbidden from an
          // endpoint without being revoked. Preserve the session and let the
          // caller render an unavailable state.
          const error = new Error('auth_forbidden');
          error.status = r1.status;
          try {
            const payload = await r1.json();
            error.code =
              typeof payload?.error === 'string' ? payload.error : null;
            error.reason =
              typeof payload?.reason === 'string' ? payload.reason : null;
            error.continueAt =
              typeof payload?.continue_at === 'string'
                ? payload.continue_at
                : null;
            error.userMessages = Array.isArray(payload?.errors)
              ? payload.errors.filter(message => typeof message === 'string')
              : [];
          } catch {
            error.userMessages = [];
          }
          throw error;
        } else {
          const error = new Error('api_request_failed');
          error.status = r1.status;
          try {
            const payload = await r1.json();
            error.userMessages = Array.isArray(payload?.errors)
              ? payload.errors.filter(message => typeof message === 'string')
              : [];
          } catch {
            error.userMessages = [];
          }
          throw error;
        }
      } finally {
        if (this._currentFetch === activeFetch) this._currentFetch = undefined;
      }
    }
  }

  multipartApi(path, formData) {
    const headers = {
      'User-Api-Key': this.authToken,
      'User-Agent': `Discourse ${Platform.OS} App / 1.0`,
      'Dont-Chunk': 'true',
      'User-Api-Client-Id': this.clientId || '',
    };
    const request = new Request(this.url + path, {
      headers,
      method: 'POST',
      body: formData,
    });
    const networkRequest = fetch(request);
    const responseRequest = networkRequest
      .then(async response => {
        if (response.status >= 200 && response.status < 300) {
          return response.json();
        }
        const classification = classifyAuthResponse(response.status);
        if (classification === 'revoked') {
          this.logoff();
          credentialStore.removeSiteToken(this.url).catch(() => {});
        }
        const error = new Error(
          classification === 'revoked'
            ? 'auth_revoked'
            : classification === 'forbidden'
            ? 'auth_forbidden'
            : 'api_request_failed',
        );
        error.status = response.status;
        try {
          const payload = await response.json();
          error.userMessages = Array.isArray(payload?.errors)
            ? payload.errors.filter(message => typeof message === 'string')
            : [];
        } catch {
          error.userMessages = [];
        }
        throw error;
      })
      .finally(() => {
        this._currentFetch = undefined;
      });
    responseRequest.abort = () => networkRequest.abort?.();
    this._currentFetch = responseRequest;
    return responseRequest;
  }

  logoff() {
    this.authToken = null;
    this.username = null;
    this.isStaff = null;
  }

  ensureLatestApi() {
    if (this.apiVersion < 2) {
      this.logoff();
    }

    const timeOffset = 14400 * 1000; // check every 4 hours

    return new Promise((resolve, reject) => {
      if (
        isNaN(this.lastChecked) ||
        Date.now() - this.lastChecked > timeOffset
      ) {
        Site.fromURL(this.url)
          .then(site => {
            resolve(site);
          })
          .catch(() => {
            reject('failure');
          });
      } else {
        resolve(this);
      }
    });
  }

  revokeApiKey() {
    return this.jsonApi('/user-api-key/revoke', 'POST');
  }

  isNew(topic) {
    return (
      topic.last_read_post_number === null &&
      ((topic.notification_level !== 0 && !topic.notification_level) ||
        topic.notification_level >= 2)
    );
  }

  isUnread(topic) {
    return (
      topic.last_read_post_number !== null &&
      topic.last_read_post_number < topic.highest_post_number &&
      topic.notification_level >= 2
    );
  }

  updateTotals() {
    let unread = 0;
    let newTopics = 0;

    _.each(this.trackingState, t => {
      if (!t.deleted && t.archetype !== 'private_message') {
        if (this.isNew(t)) {
          newTopics++;
        } else if (this.isUnread(t)) {
          unread++;
        }
      }
    });

    let changed = this.totalUnread !== unread || this.totalNew !== newTopics;

    this.totalUnread = unread;
    this.totalNew = newTopics;
    return changed;
  }

  async refresh(options = {}) {
    if (!this.authToken) {
      return 0;
    }

    const _oldTotal =
      (this.unreadNotifications || 0) +
      (this.unreadPrivateMessages || 0) +
      (this.chatNotifications || 0) +
      (this.flagCount || 0);

    try {
      let totals = await this.jsonApi('/notifications/totals.json');

      // with a chat_notifications key, user has chat enabled
      this.hasChatEnabled = typeof totals.chat_notifications === 'number';

      // The actionable notifications collection is authoritative for this
      // value. Totals can be stale or omit the field during partial responses.
      this.unreadPrivateMessages = totals.unread_personal_messages || 0;
      this.flagCount = totals.unseen_reviewables || 0;
      this.chatNotifications = totals.chat_notifications || 0;
      this.totalUnread = totals?.topic_tracking.unread || 0;
      this.totalNew = totals?.topic_tracking.new || 0;
      this.username = totals.username;
      if (totals.group_inboxes) {
        this.groupInboxes = totals.group_inboxes;
      }
      if (options.bgTask) {
        return {
          newTotal:
            this.unreadNotifications +
            this.unreadPrivateMessages +
            this.chatNotifications +
            this.flagCount,
          oldTotal: _oldTotal,
          hasPush: this.hasPush,
          url: this.url,
        };
      }
    } catch (error) {
      recordNotificationDiagnostic({
        event: 'totals_refresh',
        reason: options.reason || 'site_refresh',
        outcome: 'preserved',
        status: error?.status || 'network',
        prior: this.unreadNotifications || 0,
      });
      // Preserve last-known counters without logging private response data.
    }
  }

  async readNotification(notification) {
    await this.jsonApi('/notifications/read', 'PUT', { id: notification.id });
    const cached = this._notifications?.find(
      item => item.id === notification.id,
    );
    if (cached) cached.read = true;
  }

  getSeenNotificationId() {
    return new Promise(resolve => {
      if (!this.authToken) {
        resolve();
        return;
      }

      if (this._seenNotificationId) {
        resolve(this._seenNotificationId);
        return;
      }

      this.notifications().then(() => {
        resolve(this._seenNotificationId);
      });
    });
  }

  _filterNotifications(types, options) {
    let filtered = this._notifications || [];
    const onlyUnread = options?.onlyUnread === true;
    const minId = onlyUnread ? null : options?.minId;
    if (types || minId || onlyUnread) {
      filtered = _.filter(filtered, notification => {
        if (onlyUnread && notification.read) return false;
        if (minId && notification.read) return false;
        if (minId && minId >= notification.id) return false;
        return !types || _.includes(types, notification.notification_type);
      });
    }
    return filtered;
  }

  async notifications(types, options = {}) {
    if (!this.authToken) return [];
    const forceRefresh = options.silent === false;
    if (this._notifications && !forceRefresh) {
      return this._filterNotifications(types, options);
    }

    if (!this._notificationRequest) {
      this._notificationRequest = this.jsonApi('/native/v1/notifications')
        .then(results => {
          this._notifications = (results && results.notifications) || [];
          this._seenNotificationId = results && results.seen_notification_id;
          this._authoritativeNotificationCount =
            results && Number.isFinite(results.actionable_unread_count)
              ? results.actionable_unread_count
              : null;
        })
        .finally(() => {
          this._notificationRequest = null;
        });
    }

    try {
      await this._notificationRequest;
      return this._filterNotifications(types, options);
    } catch (error) {
      recordNotificationDiagnostic({
        event: 'list_refresh',
        reason: options.reason || 'notification_list',
        outcome: 'preserved',
        status: error?.status || 'network',
        prior: this.unreadNotifications || 0,
      });
      if (options.surfaceErrors === true) throw error;
      return [];
    }
  }

  toJSON() {
    let obj = {};
    Site.FIELDS.filter(prop => prop !== 'authToken').forEach(prop => {
      obj[prop] = this[prop];
    });
    return obj;
  }
}

export default Site;
