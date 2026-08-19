/* @flow */
'use strict';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import { decode } from 'html-entities';
import { radius, spacing, type } from './DesignSystem';
import { useProductTheme } from './ProductComponents';

const SIGNED_ACCESS_REFRESH_MS = 240000;
const inFlightRefreshes = new Map();

export const shouldRefreshSecureMedia = (resolvedAt, now = Date.now()) =>
  Number.isFinite(resolvedAt) && now - resolvedAt >= SIGNED_ACCESS_REFRESH_MS;

export function refreshSecureMedia(resourceKey, refresh) {
  if (!resourceKey || typeof refresh !== 'function') {
    return Promise.reject(new Error('media_refresh_unavailable'));
  }
  const existing = inFlightRefreshes.get(resourceKey);
  if (existing) return existing;
  const pending = Promise.resolve()
    .then(refresh)
    .finally(() => {
      if (inFlightRefreshes.get(resourceKey) === pending) {
        inFlightRefreshes.delete(resourceKey);
      }
    });
  inFlightRefreshes.set(resourceKey, pending);
  return pending;
}

export const mediaRefreshErrorMessage = error =>
  error?.status === 401 || error?.status === 403
    ? 'Sign in again to view this media.'
    : 'Media could not be refreshed. Try again.';

const absoluteUrl = (site, value) => {
  const url = decode(String(value || ''));
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${site?.url || ''}${url.startsWith('/') ? '' : '/'}${url}`;
};

export function cookedMedia(cooked, site) {
  const html = String(cooked || '');
  const results = [];
  const seen = new Set();
  const add = media => {
    if (!media.url || seen.has(media.url)) return;
    seen.add(media.url);
    results.push(media);
  };
  for (const match of html.matchAll(
    /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi,
  )) {
    const tag = match[0];
    add({
      type: 'image',
      url: absoluteUrl(site, match[1]),
      name: decode(tag.match(/alt=["']([^"']*)["']/i)?.[1] || 'Posted image'),
    });
  }
  for (const match of html.matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis,
  )) {
    const url = absoluteUrl(site, match[1]);
    if (!url || !/(\/uploads\/|upload:\/\/)/i.test(match[1])) continue;
    add({
      type: 'file',
      url,
      name: decode(match[2].replace(/<[^>]+>/g, '').trim() || 'Attachment'),
    });
  }
  return results;
}

export function chatMedia(message, site) {
  const uploads = Array.isArray(message?.uploads) ? message.uploads : [];
  return uploads
    .map(upload => ({
      type: /^(image\/|.*\.(png|jpe?g|gif|webp|heic|heif|avif)$)/i.test(
        upload.content_type || upload.original_filename || '',
      )
        ? 'image'
        : 'file',
      url: absoluteUrl(site, upload.url || upload.short_url),
      name: upload.original_filename || 'Attachment',
    }))
    .filter(media => media.url);
}

function SecureMediaImage({
  item,
  index,
  site,
  compact,
  resourceKey,
  refreshMedia,
}) {
  const colors = useProductTheme();
  const resolvedAt = useRef(Date.now());
  const automaticRefreshes = useRef(0);
  const [state, setState] = useState({
    url: item.url,
    refreshing: false,
    error: null,
  });
  const headers = site?.authToken
    ? {
        'User-Api-Key': site.authToken,
        'User-Api-Client-Id': site.clientId || '',
      }
    : undefined;

  useEffect(() => {
    resolvedAt.current = Date.now();
    automaticRefreshes.current = 0;
    setState({ url: item.url, refreshing: false, error: null });
  }, [item.url]);

  const refresh = useCallback(
    async automatic => {
      if (automatic && automaticRefreshes.current >= 1) return;
      if (automatic) automaticRefreshes.current += 1;
      setState({ refreshing: true, error: null });
      try {
        const refreshedUrl = await refreshSecureMedia(
          resourceKey,
          refreshMedia,
        );
        if (!refreshedUrl || refreshedUrl === state.url) {
          throw new Error('media_access_not_refreshed');
        }
        resolvedAt.current = Date.now();
        setState({ url: refreshedUrl, refreshing: false, error: null });
      } catch (error) {
        setState(current => ({
          ...current,
          refreshing: false,
          error: mediaRefreshErrorMessage(error),
        }));
      }
    },
    [refreshMedia, resourceKey, state.url],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (
        nextState === 'active' &&
        shouldRefreshSecureMedia(resolvedAt.current)
      ) {
        refresh(true);
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  if (state.error) {
    return (
      <View
        accessibilityRole="alert"
        style={[
          styles.mediaError,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        <FontAwesome5
          name="image"
          size={18}
          color={colors.muted}
          iconStyle="solid"
        />
        <Text style={[styles.mediaErrorText, { color: colors.muted }]}>
          {state.error}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry secure media"
          disabled={state.refreshing}
          onPress={() => refresh(false)}
          style={styles.mediaRetry}
        >
          <Text style={[styles.mediaRetryText, { color: colors.accent }]}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={item.name || `Posted image ${index + 1}`}
      accessibilityIgnoresInvertColors
      resizeMode="cover"
      source={{ uri: state.url, headers }}
      onError={() => refresh(true)}
      style={[
        styles.image,
        compact && styles.compactImage,
        {
          backgroundColor: colors.surfaceAlt,
          opacity: state.refreshing ? 0.7 : 1,
        },
      ]}
    />
  );
}

export default function DiscourseMedia({
  media,
  site,
  compact = false,
  resourceKey,
  refreshMedia,
}) {
  const colors = useProductTheme();
  if (!media?.length) return null;
  return (
    <View style={styles.gallery}>
      {media.map((item, index) =>
        item.type === 'image' ? (
          <SecureMediaImage
            key={`${item.url}-${index}`}
            item={item}
            index={index}
            site={site}
            compact={compact}
            resourceKey={`${resourceKey || 'media'}:${index}`}
            refreshMedia={
              refreshMedia ? () => refreshMedia(index) : refreshMedia
            }
          />
        ) : (
          <Pressable
            key={`${item.url}-${index}`}
            accessibilityRole="link"
            accessibilityLabel={`Open attachment ${item.name}`}
            onPress={() => Linking.openURL(item.url)}
            style={({ pressed }) => [
              styles.file,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <FontAwesome5
              name="file-alt"
              size={17}
              color={colors.accent}
              iconStyle="solid"
            />
            <Text
              numberOfLines={2}
              style={[styles.fileName, { color: colors.text }]}
            >
              {item.name}
            </Text>
            <FontAwesome5
              name="external-link-alt"
              size={12}
              color={colors.muted}
              iconStyle="solid"
            />
          </Pressable>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gallery: { gap: spacing.xs, marginTop: spacing.sm },
  image: { width: '100%', height: 220, borderRadius: radius.md },
  compactImage: { height: 160 },
  mediaError: {
    minHeight: 112,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  mediaErrorText: { ...type.metadata, textAlign: 'center' },
  mediaRetry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  mediaRetryText: { ...type.metadata, fontWeight: '700' },
  file: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fileName: { ...type.metadata, flex: 1, fontWeight: '700' },
});
