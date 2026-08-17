/* @flow */
'use strict';

import React from 'react';
import {
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

export default function DiscourseMedia({ media, site, compact = false }) {
  const colors = useProductTheme();
  if (!media?.length) return null;
  const headers = site?.authToken
    ? {
        'User-Api-Key': site.authToken,
        'User-Api-Client-Id': site.clientId || '',
      }
    : undefined;
  return (
    <View style={styles.gallery}>
      {media.map((item, index) =>
        item.type === 'image' ? (
          <Image
            key={`${item.url}-${index}`}
            accessibilityLabel={item.name || `Posted image ${index + 1}`}
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={{ uri: item.url, headers }}
            style={[
              styles.image,
              compact && styles.compactImage,
              { backgroundColor: colors.surfaceAlt },
            ]}
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
