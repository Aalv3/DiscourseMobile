/* @flow */
'use strict';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import {
  Action,
  ContentSkeleton,
  InlineState,
  NestedHeader,
  useProductTheme,
} from './ProductComponents';
import { radius, spacing, type } from './DesignSystem';
import EmojiTextInput from './EmojiTextInput';
import {
  conversationOrder,
  visibleConversationPosts,
} from './topicConversation';
import { canEditPost, loadEditablePost, savePostEdit } from './topicEditing';
import { openMemberAdjusterCard } from './memberNavigation';

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

const memberName = post => post?.name || post?.username || 'Member';

const compactExcerpt = post => {
  const value = readablePost(post?.cooked);
  return value.length > 140 ? `${value.slice(0, 137)}…` : value;
};

const avatarUrl = (site, post) => {
  const template = post?.avatar_template;
  if (!template) return null;
  const path = String(template).replace('{size}', '96');
  return /^https?:\/\//i.test(path) ? path : `${site?.url || ''}${path}`;
};

const postTime = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function replyAvailability(topic) {
  if (topic?.archived)
    return { allowed: false, reason: 'This topic is archived.' };
  if (topic?.closed) return { allowed: false, reason: 'This topic is closed.' };
  if (topic?.details?.can_create_post !== true) {
    return {
      allowed: false,
      reason:
        'Your account does not currently have permission to reply to this topic.',
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
  const scrollRef = useRef(null);
  const postPositions = useRef({});
  const [highlightedPost, setHighlightedPost] = useState(null);
  const [state, setState] = useState({
    loading: true,
    topic: null,
    error: null,
  });
  const [composer, setComposer] = useState({
    visible: false,
    mode: 'reply',
    postId: null,
    raw: '',
    replyToPostNumber: null,
    submitting: false,
    error: null,
  });
  const [creatorDelete, setCreatorDelete] = useState({
    loading: true,
    allowed: false,
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
          if (mounted)
            setState({ loading: false, topic: null, error: 'failed' });
        });
    } else {
      setState({ loading: false, topic: null, error: 'signed_out' });
    }
    return () => {
      mounted = false;
    };
  }, [route.params.topicId, site]);

  useEffect(() => {
    let mounted = true;
    setCreatorDelete({ loading: true, allowed: false });
    if (site?.authToken) {
      site
        .jsonApi(`/native/v1/topics/${route.params.topicId}/capabilities`)
        .then(payload => {
          if (mounted) {
            setCreatorDelete({
              loading: false,
              allowed: payload?.can_creator_delete === true,
            });
          }
        })
        .catch(() => {
          if (mounted) setCreatorDelete({ loading: false, allowed: false });
        });
    } else {
      setCreatorDelete({ loading: false, allowed: false });
    }
    return () => {
      mounted = false;
    };
  }, [route.params.topicId, site]);

  const posts = visibleConversationPosts(state.topic?.post_stream?.posts || []);
  const postsByNumber = Object.fromEntries(
    posts.map(post => [post.post_number, post]),
  );
  const conversation = conversationOrder(posts);

  const openComposer = replyToPostNumber =>
    setComposer({
      visible: true,
      mode: 'reply',
      postId: null,
      raw: '',
      replyToPostNumber,
      submitting: false,
      error: null,
    });

  const openEditor = async post => {
    if (!canEditPost(post)) return;
    setComposer({
      visible: true,
      mode: 'edit',
      postId: post.id,
      raw: typeof post.raw === 'string' ? post.raw : '',
      replyToPostNumber: null,
      submitting: typeof post.raw !== 'string',
      error: null,
    });
    if (typeof post.raw === 'string') return;
    try {
      const editableRaw = await loadEditablePost(site, post);
      setComposer(current => ({
        ...current,
        raw: editableRaw,
        submitting: false,
      }));
    } catch (error) {
      setComposer(current => ({
        ...current,
        submitting: false,
        error:
          error?.userMessages?.join(' ') ||
          'This post could not be prepared for editing.',
      }));
    }
  };

  const closeComposer = () => {
    if (!composer.submitting) {
      setComposer(current => ({ ...current, visible: false, error: null }));
    }
  };

  const submitComposer = async () => {
    const raw = composer.raw.trim();
    if (!raw || !state.topic?.id || !site?.authToken) return;
    setComposer(current => ({ ...current, submitting: true, error: null }));
    try {
      const editing = composer.mode === 'edit';
      const created = editing
        ? await savePostEdit(site, composer.postId, raw)
        : await site.jsonApi('/posts.json', 'POST', {
            topic_id: state.topic.id,
            raw,
            ...(composer.replyToPostNumber
              ? { reply_to_post_number: composer.replyToPostNumber }
              : {}),
          });
      setComposer(current => ({
        ...current,
        visible: false,
        submitting: false,
      }));
      await loadTopic();
      setTimeout(() => {
        if (editing) return;
        if (created?.post_number) {
          jumpToPost(created.post_number);
        } else {
          scrollRef.current?.scrollToEnd({ animated: true });
        }
      }, 180);
    } catch (error) {
      setComposer(current => ({
        ...current,
        submitting: false,
        error:
          composer.mode === 'edit'
            ? error?.userMessages?.join(' ') ||
              (error?.status === 403
                ? 'Your account is no longer permitted to edit this post.'
                : 'Your changes could not be saved. Please try again.')
            : replyErrorMessage(error),
      }));
    }
  };

  const availability = replyAvailability(state.topic);
  const replyTarget = composer.replyToPostNumber
    ? postsByNumber[composer.replyToPostNumber]
    : null;

  const jumpToPost = postNumber => {
    const y = postPositions.current[postNumber];
    if (typeof y !== 'number') return;
    setHighlightedPost(postNumber);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 72), animated: true });
    setTimeout(() => setHighlightedPost(null), 1600);
  };

  const deletePost = post =>
    Alert.alert(
      'Delete reply?',
      'This removes your reply from the discussion.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await site.jsonApi(`/posts/${post.id}.json`, 'DELETE');
              await loadTopic();
            } catch (error) {
              Alert.alert(
                'Reply not deleted',
                error?.userMessages?.join(' ') ||
                  (error?.status === 403
                    ? 'Your account cannot delete this reply.'
                    : 'The reply could not be deleted. Please try again.'),
              );
            }
          },
        },
      ],
    );

  const toggleBookmark = async post => {
    try {
      let bookmarkId = post.bookmark_id;
      if (post.bookmarked && bookmarkId) {
        await site.jsonApi(`/bookmarks/${bookmarkId}.json`, 'DELETE');
        bookmarkId = null;
      } else {
        const response = await site.jsonApi('/bookmarks.json', 'POST', {
          bookmarkable_id: post.id,
          bookmarkable_type: 'Post',
        });
        bookmarkId = response?.id;
      }
      setState(current => ({
        ...current,
        topic: {
          ...current.topic,
          post_stream: {
            ...current.topic.post_stream,
            posts: current.topic.post_stream.posts.map(candidate =>
              candidate.id === post.id
                ? {
                    ...candidate,
                    bookmarked: Boolean(bookmarkId),
                    bookmark_id: bookmarkId,
                  }
                : candidate,
            ),
          },
        },
      }));
    } catch (error) {
      Alert.alert(
        'Bookmark not updated',
        error?.userMessages?.join(' ') ||
          'The saved-item state could not be changed. Please try again.',
      );
    }
  };

  const leaveDeletedTopic = () => {
    screenProps.invalidateMemberContent();
    navigation.popToTop();
    navigation.navigate('HomeWrapper', { screen: 'Discussions' });
  };

  const deleteDiscussion = () =>
    Alert.alert(
      'Delete discussion?',
      'This will remove your discussion and its replies from Adjuster Network.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await site.jsonApi(
                `/native/v1/topics/${state.topic.id}`,
                'DELETE',
              );
              leaveDeletedTopic();
            } catch (error) {
              if (error?.status === 404) {
                leaveDeletedTopic();
                return;
              }
              Alert.alert(
                'Discussion not deleted',
                error?.userMessages?.join(' ') ||
                  (error?.status === 403
                    ? 'Your account is not authorized to delete this discussion.'
                    : 'The discussion could not be deleted. Check your connection and try again.'),
              );
            }
          },
        },
      ],
    );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <NestedHeader title="Topic" onBack={() => navigation.goBack()} />
      {state.loading ? (
        <View style={styles.content}>
          <ContentSkeleton rows={5} />
        </View>
      ) : state.error ? (
        <View style={styles.content}>
          <InlineState
            icon="comments"
            title="This discussion isn’t available"
            body="It may have been removed or the Network may be temporarily unreachable."
            action={<Action label="Try again" secondary onPress={loadTopic} />}
          />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[styles.topicHeader, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.topicKicker, { color: colors.accent }]}>
              MEMBER DISCUSSION
            </Text>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.text }]}
            >
              {state.topic?.title}
            </Text>
            <Text style={[styles.topicSummary, { color: colors.muted }]}>
              {conversation.length}{' '}
              {conversation.length === 1 ? 'contribution' : 'contributions'}
            </Text>
            <View style={styles.topicRule}>
              <View
                style={[
                  styles.topicRuleAccent,
                  { backgroundColor: colors.brandAccent },
                ]}
              />
              <View
                style={[
                  styles.topicRuleRest,
                  { backgroundColor: colors.border },
                ]}
              />
            </View>
          </View>
          {creatorDelete.allowed ? (
            <View style={styles.topicManagement}>
              <Action
                label="Delete discussion"
                icon="trash"
                secondary
                onPress={deleteDiscussion}
              />
            </View>
          ) : null}
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
          {conversation.map(({ post, depth }, index) => {
            const parent = post.reply_to_post_number
              ? postsByNumber[post.reply_to_post_number]
              : null;
            const avatar = avatarUrl(site, post);
            return (
              <View
                key={post.id}
                onLayout={event => {
                  postPositions.current[post.post_number] =
                    event.nativeEvent.layout.y;
                }}
                style={[
                  styles.post,
                  {
                    backgroundColor:
                      highlightedPost === post.post_number
                        ? colors.accentSoft
                        : index === 0
                        ? colors.surfaceWarm
                        : colors.canvas,
                    borderColor:
                      highlightedPost === post.post_number
                        ? colors.accent
                        : colors.border,
                  },
                  index === 0 && [
                    styles.originalPost,
                    { borderTopColor: colors.accent },
                  ],
                  depth > 1 && styles.threadedReply,
                ]}
              >
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${memberName(post)} Adjuster Card`}
                  disabled={!post.username}
                  onPress={() =>
                    openMemberAdjusterCard(navigation, post.username)
                  }
                  style={styles.identityRow}
                >
                  {avatar ? (
                    <Image
                      accessibilityLabel={`${memberName(post)} avatar`}
                      source={{ uri: avatar }}
                      style={styles.postAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.postAvatar,
                        styles.avatarFallback,
                        { backgroundColor: colors.accent },
                      ]}
                    >
                      <Text style={styles.avatarInitial}>
                        {memberName(post).slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.identityCopy}>
                    <Text style={[styles.author, { color: colors.text }]}>
                      {memberName(post)}
                    </Text>
                    <Text style={[styles.postMeta, { color: colors.muted }]}>
                      @{post.username || 'member'} · {postTime(post.created_at)}
                    </Text>
                  </View>
                  {index === 0 ? (
                    <View
                      style={[
                        styles.starterBadge,
                        { backgroundColor: colors.brandAccentSoft },
                      ]}
                    >
                      <Text
                        style={[
                          styles.starterBadgeText,
                          { color: colors.brandAccent },
                        ]}
                      >
                        STARTER
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                {post.reply_to_post_number ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      parent
                        ? `Jump to reply from ${memberName(parent)}`
                        : 'Referenced reply unavailable'
                    }
                    disabled={!parent}
                    onPress={() => jumpToPost(post.reply_to_post_number)}
                    style={[
                      styles.replyContext,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderLeftColor: colors.accent,
                      },
                    ]}
                  >
                    <Text style={[styles.replyingTo, { color: colors.accent }]}>
                      ↳ Replying to{' '}
                      {parent ? memberName(parent) : 'an unavailable post'}
                    </Text>
                    {parent ? (
                      <Text
                        numberOfLines={2}
                        style={[styles.contextExcerpt, { color: colors.muted }]}
                      >
                        {compactExcerpt(parent)}
                      </Text>
                    ) : null}
                  </Pressable>
                ) : null}
                <Text selectable style={[styles.body, { color: colors.text }]}>
                  {readablePost(post.cooked)}
                </Text>
                <View style={styles.postActions}>
                  {availability.allowed ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Reply to ${
                        post.name || post.username || 'member'
                      }`}
                      onPress={() => openComposer(post.post_number)}
                      style={styles.postReply}
                    >
                      <FontAwesome5
                        name="reply"
                        size={12}
                        color={colors.accent}
                        iconStyle="solid"
                      />
                      <Text
                        style={[styles.postReplyText, { color: colors.accent }]}
                      >
                        Reply
                      </Text>
                    </Pressable>
                  ) : null}
                  {canEditPost(post) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit your ${
                        post.post_number === 1 ? 'discussion' : 'reply'
                      }`}
                      onPress={() => openEditor(post)}
                      style={styles.postReply}
                    >
                      <FontAwesome5
                        name="pen"
                        size={12}
                        color={colors.accent}
                        iconStyle="solid"
                      />
                      <Text
                        style={[styles.postReplyText, { color: colors.accent }]}
                      >
                        Edit
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      post.bookmarked ? 'Remove bookmark' : 'Bookmark post'
                    }
                    onPress={() => toggleBookmark(post)}
                    style={styles.postReply}
                  >
                    <FontAwesome5
                      name="bookmark"
                      size={12}
                      color={colors.accent}
                      iconStyle="solid"
                    />
                    <Text
                      style={[styles.postReplyText, { color: colors.accent }]}
                    >
                      <FontAwesome5
                        name="trash"
                        size={12}
                        color={colors.danger}
                        iconStyle="solid"
                      />
                      {post.bookmarked ? 'Saved' : 'Save'}
                    </Text>
                  </Pressable>
                  {post.can_delete ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete your reply"
                      onPress={() => deletePost(post)}
                      style={styles.postReply}
                    >
                      <Text
                        style={[styles.postReplyText, { color: colors.danger }]}
                      >
                        Delete
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
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
          <NestedHeader
            title={composer.mode === 'edit' ? 'Edit post' : 'Reply'}
            onBack={closeComposer}
          />
          <ScrollView
            contentContainerStyle={styles.composerContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              accessibilityRole="header"
              style={[styles.composerTitle, { color: colors.text }]}
            >
              {composer.mode === 'edit'
                ? 'Edit your contribution'
                : replyTarget
                ? `Replying to ${memberName(replyTarget)}`
                : 'Join the discussion'}
            </Text>
            {composer.mode === 'reply' && replyTarget ? (
              <View
                style={[
                  styles.composerTarget,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderLeftColor: colors.accent,
                  },
                ]}
              >
                <Text
                  numberOfLines={3}
                  style={[styles.contextExcerpt, { color: colors.text }]}
                >
                  {compactExcerpt(replyTarget)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change to topic-level reply"
                  onPress={() =>
                    setComposer(current => ({
                      ...current,
                      replyToPostNumber: null,
                    }))
                  }
                  style={styles.changeTarget}
                >
                  <Text
                    style={[styles.postReplyText, { color: colors.accent }]}
                  >
                    Reply to topic instead
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <Text style={[styles.guidance, { color: colors.warning }]}>
              Keep claim data out. Do not include names, addresses, policy or
              claim numbers, photos, documents, or identifying facts.
            </Text>
            <EmojiTextInput
              accessibilityLabel="Reply text"
              autoFocus
              editable={!composer.submitting}
              multiline
              onChangeText={raw =>
                setComposer(current => ({ ...current, raw, error: null }))
              }
              placeholder={
                composer.mode === 'edit'
                  ? 'Update your contribution…'
                  : 'Write a helpful reply…'
              }
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              textAlignVertical="top"
              value={composer.raw}
            />
            {composer.error ? (
              <Text
                accessibilityRole="alert"
                style={[styles.submitError, { color: colors.danger }]}
              >
                {composer.error}
              </Text>
            ) : null}
            <View style={styles.composerActions}>
              <Action
                label="Cancel"
                secondary
                disabled={composer.submitting}
                onPress={closeComposer}
              />
              <Action
                label={
                  composer.submitting
                    ? composer.mode === 'edit'
                      ? 'Saving…'
                      : 'Posting…'
                    : composer.mode === 'edit'
                    ? 'Save changes'
                    : 'Post reply'
                }
                disabled={composer.submitting || !composer.raw.trim()}
                onPress={submitComposer}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topicManagement: {
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
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
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '820',
    marginTop: spacing.xs,
  },
  topicHeader: {
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
    borderBottomWidth: 0,
  },
  topicKicker: type.label,
  topicSummary: { ...type.metadata, marginTop: spacing.xs },
  topicRule: { flexDirection: 'row', height: 2, marginTop: spacing.md },
  topicRuleAccent: { width: 52 },
  topicRuleRest: { flex: 1 },
  post: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
  },
  originalPost: {
    borderLeftWidth: 3,
    borderBottomWidth: 0,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  threadedReply: {
    marginLeft: 24,
    borderLeftWidth: 2,
    paddingLeft: spacing.md,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  postAvatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  identityCopy: { flex: 1 },
  author: { fontSize: 15, fontWeight: '800' },
  starterBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  starterBadgeText: { ...type.label, fontSize: 9 },
  postMeta: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  body: { fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  replyContext: {
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  replyingTo: { fontSize: 13, lineHeight: 18, fontWeight: '750' },
  contextExcerpt: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  postActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  primaryReply: { alignItems: 'flex-start', marginBottom: spacing.md },
  unavailable: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  postReply: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  postReplyText: { fontSize: 15, fontWeight: '700' },
  composer: { flex: 1 },
  composerContent: { padding: spacing.md, paddingBottom: spacing.xl },
  composerTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  guidance: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  composerTarget: {
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  changeTarget: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
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
