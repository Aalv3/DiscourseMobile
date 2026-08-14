/* @flow */
'use strict';

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import { decode } from 'html-entities';
import { activeMemberSite } from './ProductData';
import { useProductTheme } from './ProductComponents';
import { radius, spacing } from './DesignSystem';

function readablePost(cooked) {
  return decode(
    String(cooked || '')
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/li>|<\/blockquote>|<\/h[1-6]>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

export default function NativeTopicScreen({ navigation, route, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const [state, setState] = useState({
    loading: true,
    topic: null,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    if (!site?.authToken) {
      setState({ loading: false, topic: null, error: 'signed_out' });
      return () => {};
    }
    site
      .jsonApi(`/t/${route.params.topicId}.json`)
      .then(topic => {
        if (mounted) setState({ loading: false, topic, error: null });
      })
      .catch(() => {
        if (mounted) setState({ loading: false, topic: null, error: 'failed' });
      });
    return () => {
      mounted = false;
    };
  }, [route.params.topicId, site]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <View style={[styles.navigation, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to member discussions"
          hitSlop={10}
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <FontAwesome5 name="chevron-left" size={16} color={colors.accent} />
          <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
        </Pressable>
        <Text style={[styles.brand, { color: colors.accent }]}>
          ADJUSTER NETWORK
        </Text>
      </View>
      {state.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.status, { color: colors.muted }]}>
            Loading topic…
          </Text>
        </View>
      ) : state.error ? (
        <View style={styles.center}>
          <Text
            accessibilityRole="header"
            style={[styles.errorTitle, { color: colors.text }]}
          >
            Topic unavailable
          </Text>
          <Text style={[styles.status, { color: colors.muted }]}>
            This authenticated topic could not be loaded.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            {state.topic?.title}
          </Text>
          {(state.topic?.post_stream?.posts || []).map(post => (
            <View
              key={post.id}
              style={[
                styles.post,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.author, { color: colors.accent }]}>
                {post.name || post.username || 'Member'}
              </Text>
              <Text selectable style={[styles.body, { color: colors.text }]}>
                {readablePost(post.cooked)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navigation: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 },
  backText: { fontSize: 16, fontWeight: '650' },
  brand: { fontSize: 11, fontWeight: '850', letterSpacing: 0.8 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  status: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorTitle: { fontSize: 22, fontWeight: '800' },
  content: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  post: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  author: { fontSize: 13, fontWeight: '800', marginBottom: spacing.sm },
  body: { fontSize: 16, lineHeight: 24 },
});
