/* @flow */
'use strict';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activeMemberSite, topicPath } from './ProductData';
import { Action, NestedHeader, useProductTheme } from './ProductComponents';
import { radius, spacing } from './DesignSystem';

const titleFromSlug = slug =>
  String(slug || 'Collection')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export default function NativeCollectionScreen({
  navigation,
  route,
  screenProps,
}) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const [state, setState] = useState({
    loading: true,
    topics: [],
    error: null,
  });

  const load = useCallback(async () => {
    if (!site?.authToken) {
      setState({ loading: false, topics: [], error: 'signed_out' });
      return;
    }
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const payload = await site.jsonApi(route.params.endpoint);
      setState({
        loading: false,
        topics: payload?.topic_list?.topics || payload?.topics || [],
        error: null,
      });
    } catch {
      setState({ loading: false, topics: [], error: 'failed' });
    }
  }, [route.params.endpoint, site]);

  useEffect(() => {
    load();
  }, [load]);

  const title = titleFromSlug(route.params.slug);
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <NestedHeader title={title} onBack={() => navigation.goBack()} />
      {state.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.status, { color: colors.muted }]}>
            Loading {title}…
          </Text>
        </View>
      ) : state.error ? (
        <View style={styles.center}>
          <Text
            accessibilityRole="header"
            style={[styles.heading, { color: colors.text }]}
          >
            Content unavailable
          </Text>
          <Text style={[styles.status, { color: colors.muted }]}>
            This member collection could not be loaded.
          </Text>
          <Action label="Try again" secondary onPress={load} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text
            accessibilityRole="header"
            style={[styles.heading, { color: colors.text }]}
          >
            {title}
          </Text>
          <Text style={[styles.intro, { color: colors.muted }]}>
            Authenticated Adjuster Network content, presented natively.
          </Text>
          {state.topics.length ? (
            state.topics.map(topic => (
              <Pressable
                accessibilityRole="link"
                key={topic.id}
                onPress={() =>
                  screenProps.openUrl(`${site.url}${topicPath(topic)}`)
                }
                style={({ pressed }) => [
                  styles.topic,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Text style={[styles.topicTitle, { color: colors.text }]}>
                  {topic.title}
                </Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  Open conversation · {topic.views || 0} views
                </Text>
              </Pressable>
            ))
          ) : (
            <View
              style={[
                styles.empty,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Nothing published yet
              </Text>
              <Text style={[styles.status, { color: colors.muted }]}>
                There is no current approved content in this collection. Nothing
                stale or placeholder-based is being shown.
              </Text>
              <Action label="Check again" secondary onPress={load} />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heading: { fontSize: 26, lineHeight: 33, fontWeight: '800' },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  status: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  topic: {
    minHeight: 76,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  topicTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: spacing.xs },
  empty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: spacing.xs },
});
