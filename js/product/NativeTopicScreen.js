/* @flow */
'use strict';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { decode } from 'html-entities';
import { activeMemberSite } from './ProductData';
import { Action, NestedHeader, useProductTheme } from './ProductComponents';
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

export function replyAvailability(topic) {
  if (topic?.archived) return { allowed: false, reason: 'This topic is archived.' };
  if (topic?.closed) return { allowed: false, reason: 'This topic is closed.' };
  if (topic?.details?.can_create_post !== true) {
    return {
      allowed: false,
      reason: 'Your account does not currently have permission to reply to this topic.',
    };
  }
  return { allowed: true, reason: null };
}

export function replyErrorMessage(error) {
  if (error?.status === 403) {
    return 'Your account is not permitted to reply to this topic.';
  }
  if (error?.status === 422 && error?.userMessages?.length) {
    return error.userMessages.join(' ');
  }
  if (error?.status === 429) {
    return 'Replies are temporarily rate-limited. Please wait and try again.';
  }
  return 'Reply could not be posted. Check your connection and try again.';
}

export default function NativeTopicScreen({ navigation, route, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const [state, setState] = useState({
    loading: true,
    topic: null,
    error: null,
  });
  const [composer, setComposer] = useState({
    visible: false,
    raw: '',
    replyToPostNumber: null,
    submitting: false,
    error: null,
  });

  const loadTopic = useCallback(async () => {
    if (!site?.authToken) {
      setState({ loading: false, topic: null, error: 'signed_out' });
      return;
    }
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const topic = await site.jsonApi(`/t/${route.params.topicId}.json`);
      setState({ loading: false, topic, error: null });
    } catch {
      setState({ loading: false, topic: null, error: 'failed' });
    }
  }, [route.params.topicId, site]);

  useEffect(() => {
    let mounted = true;
    if (site?.authToken) {
      site
      .jsonApi(`/t/${route.params.topicId}.json`)
      .then(topic => {
        if (mounted) setState({ loading: false, topic, error: null });
      })
      .catch(() => {
        if (mounted) setState({ loading: false, topic: null, error: 'failed' });
      });
    } else {
      setState({ loading: false, topic: null, error: 'signed_out' });
    }
    return () => {
      mounted = false;
    };
  }, [route.params.topicId, site]);

  const openComposer = replyToPostNumber =>
    setComposer({
      visible: true,
      raw: '',
      replyToPostNumber,
      submitting: false,
      error: null,
    });

  const closeComposer = () => {
    if (!composer.submitting) {
      setComposer(current => ({ ...current, visible: false, error: null }));
    }
  };

  const submitReply = async () => {
    const raw = composer.raw.trim();
    if (!raw || !state.topic?.id || !site?.authToken) return;
    setComposer(current => ({ ...current, submitting: true, error: null }));
    try {
      await site.jsonApi('/posts.json', 'POST', {
        topic_id: state.topic.id,
        raw,
        ...(composer.replyToPostNumber
          ? { reply_to_post_number: composer.replyToPostNumber }
          : {}),
      });
      setComposer(current => ({ ...current, visible: false, submitting: false }));
      await loadTopic();
    } catch (error) {
      setComposer(current => ({
        ...current,
        submitting: false,
        error: replyErrorMessage(error),
      }));
    }
  };

  const availability = replyAvailability(state.topic);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <NestedHeader title="Topic" onBack={() => navigation.goBack()} />
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            {state.topic?.title}
          </Text>
          {availability.allowed ? (
            <View style={styles.primaryReply}>
              <Action
                label="Join discussion"
                icon="reply"
                onPress={() => openComposer(null)}
              />
            </View>
          ) : (
            <Text style={[styles.unavailable, { color: colors.muted }]}>
              {availability.reason}
            </Text>
          )}
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
              {availability.allowed ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Reply to ${post.name || post.username || 'member'}`}
                  onPress={() => openComposer(post.post_number)}
                  style={styles.postReply}
                >
                  <Text style={[styles.postReplyText, { color: colors.accent }]}>Reply</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
      <Modal
        animationType="slide"
        onRequestClose={closeComposer}
        presentationStyle="pageSheet"
        visible={composer.visible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.composer, { backgroundColor: colors.canvas }]}
        >
          <NestedHeader title="Reply" onBack={closeComposer} />
          <ScrollView
            contentContainerStyle={styles.composerContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text accessibilityRole="header" style={[styles.composerTitle, { color: colors.text }]}>
              {composer.replyToPostNumber ? 'Reply to this post' : 'Join the discussion'}
            </Text>
            <Text style={[styles.guidance, { color: colors.warning }]}>
              Keep claim data out. Do not include names, addresses, policy or claim numbers, photos, documents, or identifying facts.
            </Text>
            <TextInput
              accessibilityLabel="Reply text"
              autoFocus
              editable={!composer.submitting}
              multiline
              onChangeText={raw => setComposer(current => ({ ...current, raw, error: null }))}
              placeholder="Write a helpful reply…"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
              ]}
              textAlignVertical="top"
              value={composer.raw}
            />
            {composer.error ? (
              <Text accessibilityRole="alert" style={[styles.submitError, { color: colors.danger }]}>
                {composer.error}
              </Text>
            ) : null}
            <View style={styles.composerActions}>
              <Action label="Cancel" secondary disabled={composer.submitting} onPress={closeComposer} />
              <Action
                label={composer.submitting ? 'Posting…' : 'Post reply'}
                disabled={composer.submitting || !composer.raw.trim()}
                onPress={submitReply}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
  primaryReply: { alignItems: 'flex-start', marginBottom: spacing.md },
  unavailable: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  postReply: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  postReplyText: { fontSize: 15, fontWeight: '700' },
  composer: { flex: 1 },
  composerContent: { padding: spacing.md, paddingBottom: spacing.xl },
  composerTitle: { fontSize: 24, lineHeight: 31, fontWeight: '800', marginBottom: spacing.sm },
  guidance: { fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: spacing.md },
  input: {
    minHeight: 180,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 17,
    lineHeight: 24,
  },
  submitError: { fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  composerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
