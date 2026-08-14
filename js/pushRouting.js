/* @flow */
'use strict';

const SAFE_MEMBER_PATH = /^\/(t|c|u)\/[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*$/;

export function shouldObserveRemoteNotifications(platform, deliveryEnabled) {
  return platform === 'ios' && deliveryEnabled === true;
}

export function safePushPath(payload) {
  const path = payload?.an?.route;
  if (typeof path !== 'string') {
    return null;
  }
  if (path.length > 2048 || !SAFE_MEMBER_PATH.test(path)) {
    return null;
  }
  if (path.includes('..') || path.includes('://')) {
    return null;
  }
  return path;
}

export function notificationPayload(notification) {
  if (!notification || typeof notification !== 'object') {
    return null;
  }
  if (typeof notification.getData === 'function') {
    try {
      const data = notification.getData();
      if (data && typeof data === 'object') {
        return data;
      }
    } catch {
      return null;
    }
  }
  for (const candidate of [
    notification._data,
    notification.data,
    notification,
  ]) {
    if (candidate && typeof candidate === 'object') {
      return candidate;
    }
  }
  return null;
}

export function notificationTapPath(notification) {
  const payload = notificationPayload(notification);
  const interacted =
    payload?.openedInForeground === 1 ||
    payload?.openedInForeground === true ||
    payload?.userInteraction === 1 ||
    payload?.userInteraction === true ||
    notification?.getUserInteraction?.() === true;
  return interacted ? safePushPath(payload) : null;
}

export function routePush(payload, { origin, authenticated, openUrl }) {
  const path = safePushPath(payload);
  if (!authenticated || !path || typeof openUrl !== 'function') {
    return false;
  }
  openUrl(`${origin}${path}`);
  return true;
}

export class PendingPushRoute {
  path = null;

  accept(notification) {
    const path = notificationTapPath(notification);
    if (!path) return false;
    this.path = path;
    return true;
  }

  flush({ origin, authenticated, navigationReady, openUrl }) {
    if (!this.path || !navigationReady) return false;
    const path = this.path;
    const routed = routePush(
      { an: { route: path } },
      { origin, authenticated, openUrl },
    );
    if (routed) this.path = null;
    return routed;
  }
}
