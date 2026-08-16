/* @flow */
'use strict';

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activeMemberSite, topicPath } from './ProductData';
import {
  Action,
  ContentSkeleton,
  InlineState,
  MemberAvatar,
  NestedHeader,
  useProductTheme,
} from './ProductComponents';
import { radius, spacing } from './DesignSystem';
import { collectionTopics } from './collectionData';

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
        topics: collectionTopics(payload),
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
        <View style={styles.content}>
          <ContentSkeleton rows={4} />
        </View>
      ) : state.error ? (
        <View style={styles.content}>
          <InlineState
            icon="signal"
            title="Couldn’t refresh this desk"
            body="The latest published material is temporarily unavailable. Your account remains connected."
            action={<Action label="Try again" secondary onPress={load} />}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.eyebrow, { color: colors.brandAccent }]}>
            NETWORK INTELLIGENCE
          </Text>
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
                <MemberAvatar
                  label={topic.last_poster_username || 'Network member'}
                  size={38}
                />
                <View style={styles.topicCopy}>
                  <Text style={[styles.topicTitle, { color: colors.text }]}>
                    {topic.title}
                  </Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>
                    {topic.last_poster_username || 'Network member'} ·{' '}
                    {Math.max(0, (topic.posts_count || 1) - 1)} replies ·{' '}
                    {topic.views || 0} views
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View
              style={[
                styles.empty,
                {
                  backgroundColor: colors.surfaceWarm,
                  borderLeftColor: colors.brandAccent,
                },
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
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.05,
  },
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  topicCopy: { flex: 1 },
  topicTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: spacing.xs },
  empty: {
    borderWidth: 0,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: spacing.xs },
});
