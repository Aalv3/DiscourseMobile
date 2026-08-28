/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';

const KEY = '@AdjusterNetwork.avatarImageDiagnostics.v1';
const LIMIT = 180;
let write = Promise.resolve();
let mountCounter = 0;

const allowed = new Set([
  'timestamp',
  'event',
  'consumer',
  'mountId',
  'authorityVersion',
  'sourceClass',
  'routeClass',
  'width',
  'height',
  'category',
  'message',
  'afterLoad',
  'fallbackReplacesRemote',
]);

const bounded = value => String(value ?? 'none').slice(0, 48);

export function createAvatarImageMountId(consumer) {
  mountCounter += 1;
  return `avatar-${bounded(consumer)}-${Date.now().toString(
    36,
  )}-${mountCounter}`;
}

export function avatarSourceClass(template) {
  if (!template) return 'initials';
  return String(template).includes('/user_avatar/')
    ? 'custom_remote'
    : 'default';
}

export function avatarRouteClass(template) {
  if (!template) return 'none';
  const value = String(template);
  if (value.startsWith('/user_avatar/')) return 'user_avatar_route';
  if (/^https?:\/\//i.test(value)) return 'absolute_remote';
  return 'relative_remote';
}

export function sanitizedAvatarImageError(error) {
  const value = String(
    error?.nativeEvent?.error || error?.message || '',
  ).toLowerCase();
  if (value.includes('decode'))
    return { category: 'decode', message: 'decode_failed' };
  if (value.includes('http'))
    return { category: 'http', message: 'http_failed' };
  if (value.includes('network') || value.includes('connect')) {
    return { category: 'network', message: 'network_failed' };
  }
  return { category: 'unknown', message: 'image_load_failed' };
}

export function recordAvatarImageDiagnostic(input) {
  const entry = { timestamp: Date.now() };
  Object.entries(input || {}).forEach(([key, value]) => {
    if (!allowed.has(key) || value === undefined) return;
    if (['authorityVersion', 'width', 'height'].includes(key)) {
      entry[key] = Number.isFinite(Number(value)) ? Number(value) : -1;
    } else if (['afterLoad', 'fallbackReplacesRemote'].includes(key)) {
      entry[key] = value === true;
    } else {
      entry[key] = bounded(value);
    }
  });
  write = write
    .then(async () => {
      let rows = [];
      try {
        const stored = await AsyncStorage.getItem(KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) rows = parsed;
      } catch {
        // Rendering diagnostics never affect avatar behavior.
      }
      rows.push(entry);
      await AsyncStorage.setItem(KEY, JSON.stringify(rows.slice(-LIMIT)));
    })
    .catch(() => {});
  return entry;
}

export function useAvatarImageDiagnostics({
  consumer,
  componentMountId,
  authorityVersion,
  template,
  sourceIdentity,
  width,
  height,
}) {
  const mountIdRef = useRef(null);
  if (!mountIdRef.current) {
    mountIdRef.current = `${componentMountId}-${createAvatarImageMountId(
      consumer,
    )}`;
  }
  const mountId = mountIdRef.current;
  const loaded = useRef(false);
  const previousSource = useRef(sourceIdentity);
  const sourceClass = avatarSourceClass(template);
  const routeClass = avatarRouteClass(template);
  const base = {
    consumer,
    mountId,
    authorityVersion,
    sourceClass,
    routeClass,
    width,
    height,
  };
  const latestBase = useRef(base);
  latestBase.current = base;

  useEffect(() => {
    recordAvatarImageDiagnostic({ ...latestBase.current, event: 'mount' });
    return () =>
      recordAvatarImageDiagnostic({
        ...latestBase.current,
        event: 'unmount',
      });
    // Mount and unmount ordering is intentionally scoped to this Image instance.
  }, [mountId]);

  useEffect(() => {
    const changed = previousSource.current !== sourceIdentity;
    if (changed) {
      recordAvatarImageDiagnostic({
        ...base,
        event: 'source_changed',
        afterLoad: loaded.current,
      });
      loaded.current = false;
      previousSource.current = sourceIdentity;
    }
    recordAvatarImageDiagnostic({ ...base, event: 'render' });
    if (sourceClass === 'initials') {
      recordAvatarImageDiagnostic({
        ...base,
        event: 'fallback_selection',
        fallbackReplacesRemote: false,
      });
    }
    // sourceIdentity is observed but never persisted.
  }, [sourceIdentity, authorityVersion, sourceClass, routeClass]);

  return {
    onLoadStart: () =>
      recordAvatarImageDiagnostic({ ...base, event: 'onLoadStart' }),
    onLoad: () => {
      loaded.current = true;
      recordAvatarImageDiagnostic({ ...base, event: 'onLoad' });
    },
    onError: error => {
      const sanitized = sanitizedAvatarImageError(error);
      recordAvatarImageDiagnostic({
        ...base,
        event: 'onError',
        ...sanitized,
        fallbackReplacesRemote: false,
      });
    },
    onLoadEnd: () =>
      recordAvatarImageDiagnostic({ ...base, event: 'onLoadEnd' }),
  };
}

export const avatarImageDiagnosticKey = KEY;
export const avatarImageDiagnosticLimit = LIMIT;
