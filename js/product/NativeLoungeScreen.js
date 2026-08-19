/* @flow */
'use strict';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import {
  Action,
  ContentSkeleton,
  InlineState,
  V2BrandHeader,
  useProductTheme,
} from './ProductComponents';
import { activeMemberSite } from './ProductData';
import { radius, spacing, type } from './DesignSystem';
import EmojiTextInput from './EmojiTextInput';
import DiscourseMedia, { chatMedia } from './DiscourseMedia';
import {
  canSendToLounge,
  canDeleteOwnLoungeMessage,
  findLoungeChannel,
  loungeMessagesPath,
  loungeSendDisabledReason,
  mergeChatMessages,
  normalizeChatMessages,
} from './LoungeChat';
import { openMemberAdjusterCard } from './memberNavigation';

export default function NativeLoungeScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const site = activeMemberSite(screenProps.siteManager);
  const listRef = useRef(null);
  const loadingOlder = useRef(false);
  const didInitialScroll = useRef(false);
  const [chat, setChat] = useState({
    loading: true,
    channel: null,
    messages: [],
    canLoadMorePast: false,
    error: null,
  });
  const [composer, setComposer] = useState({
    message: '',
    submitting: false,
    error: null,
  });
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener('keyboardWillHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const discoverChannel = useCallback(async () => {
    if (!site?.authToken) return null;
    const [memberChannels, availableChannels] = await Promise.all([
      site.jsonApi('/chat/api/me/channels.json').catch(() => null),
      site
        .jsonApi('/chat/api/channels.json?filter=lounge&limit=50')
        .catch(() => null),
    ]);
    return findLoungeChannel([memberChannels, availableChannels]);
  }, [site]);

  const loadLounge = useCallback(async () => {
    if (!site?.authToken) return;
    setChat(current => ({ ...current, loading: true, error: null }));
    try {
      const channel = await discoverChannel();
      if (!channel) throw new Error('lounge_channel_missing');
      const payload = await site.jsonApi(loungeMessagesPath(channel.id));
      setChat({
        loading: false,
        channel,
        messages: normalizeChatMessages(payload),
        canLoadMorePast: payload?.meta?.can_load_more_past === true,
        error: null,
      });
    } catch (error) {
      setChat(current => ({
        ...current,
        loading: false,
        error:
          error?.message === 'lounge_channel_missing'
            ? 'channel_missing'
            : 'failed',
      }));
    }
  }, [discoverChannel, site]);

  useEffect(() => {
    loadLounge();
  }, [loadLounge]);

  const refreshMessages = useCallback(async () => {
    if (!site?.authToken || !chat.channel?.id) return;
    try {
      const payload = await site.jsonApi(loungeMessagesPath(chat.channel.id));
      setChat(current => ({
        ...current,
        messages: mergeChatMessages(
          current.messages,
          normalizeChatMessages(payload),
        ),
        error: null,
      }));
    } catch {
      // Preserve visible history during a transient bounded refresh failure.
    }
  }, [chat.channel?.id, site]);

  const refreshLoungeMedia = useCallback(
    async (messageId, mediaIndex) => {
      if (!site?.authToken) {
        const error = new Error('signed_out');
        error.status = 401;
        throw error;
      }
      if (!chat.channel?.id) throw new Error('lounge_channel_missing');
      const payload = await site.jsonApi(loungeMessagesPath(chat.channel.id));
      const messages = normalizeChatMessages(payload);
      setChat(current => ({
        ...current,
        messages: mergeChatMessages(current.messages, messages),
        error: null,
      }));
      const message = messages.find(item => item.id === messageId);
      return chatMedia(message, site)[mediaIndex]?.url || null;
    },
    [chat.channel?.id, site],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refreshMessages();
    }, 10000);
    return () => clearInterval(timer);
  }, [refreshMessages]);

  const loadOlderMessages = useCallback(async () => {
    const oldestId = chat.messages[0]?.id;
    if (
      loadingOlder.current ||
      !chat.canLoadMorePast ||
      !chat.channel?.id ||
      !oldestId
    ) {
      return;
    }
    loadingOlder.current = true;
    try {
      const payload = await site.jsonApi(
        loungeMessagesPath(chat.channel.id, oldestId),
      );
      setChat(current => ({
        ...current,
        messages: mergeChatMessages(
          normalizeChatMessages(payload),
          current.messages,
        ),
        canLoadMorePast: payload?.meta?.can_load_more_past === true,
      }));
    } finally {
      loadingOlder.current = false;
    }
  }, [chat.canLoadMorePast, chat.channel?.id, chat.messages, site]);

  const submitMessage = async () => {
    const message = composer.message.trim();
    if (!message || !chat.channel?.id || !site?.authToken) return;
    setComposer(current => ({ ...current, submitting: true, error: null }));
    try {
      if (!chat.channel.current_user_membership) {
        await site.jsonApi(
          `/chat/api/channels/${chat.channel.id}/memberships/me.json`,
          'POST',
        );
      }
      await site.jsonApi(`/chat/${chat.channel.id}.json`, 'POST', {
        message,
      });
      setComposer({ message: '', submitting: false, error: null });
      await refreshMessages();
      globalThis.requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true }),
      );
    } catch (error) {
      setComposer(current => ({
        ...current,
        submitting: false,
        error:
          error?.userMessages?.[0] ||
          'Message could not be sent. Check your permissions or connection and try again.',
      }));
    }
  };

  const deleteMessage = item => {
    Alert.alert(
      'Delete Lounge message?',
      'This removes your message from the Lounge.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await site.jsonApi(
                `/chat/api/channels/${chat.channel.id}/messages/${item.id}.json`,
                'DELETE',
              );
              setChat(current => ({
                ...current,
                messages: current.messages.filter(
                  message => message.id !== item.id,
                ),
              }));
              await refreshMessages();
            } catch (error) {
              Alert.alert(
                'Message not deleted',
                error?.status === 403
                  ? 'Your account cannot delete this Lounge message.'
                  : 'The message could not be deleted. Check your connection and try again.',
              );
            }
          },
        },
      ],
    );
  };

  const renderMessage = ({ item }) => {
    const user = item.user || {};
    const avatarUri = user.avatar_template
      ? `${site.url}${user.avatar_template.replace('{size}', '72')}`
      : null;
    const timestamp = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';
    const body = String(item.message || item.excerpt || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return (
      <View
        style={[
          styles.message,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${
            user.name || user.username || 'member'
          } Adjuster Card`}
          disabled={!user.username}
          onPress={() => openMemberAdjusterCard(navigation, user.username)}
        >
          {avatarUri ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: avatarUri }}
              style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}
            />
          ) : (
            <View
              style={[styles.avatar, { backgroundColor: colors.accentSoft }]}
            />
          )}
        </Pressable>
        <View style={styles.messageCopy}>
          <View style={styles.messageMeta}>
            <Pressable
              accessibilityRole="link"
              disabled={!user.username}
              onPress={() => openMemberAdjusterCard(navigation, user.username)}
            >
              <Text style={[styles.author, { color: colors.text }]}>
                {user.name || user.username || 'Member'}
              </Text>
            </Pressable>
            <Text style={[styles.timestamp, { color: colors.muted }]}>
              {timestamp}
            </Text>
          </View>
          <Text selectable style={[styles.body, { color: colors.text }]}>
            {body}
          </Text>
          <DiscourseMedia
            media={chatMedia(item, site)}
            site={site}
            compact
            resourceKey={`lounge:${chat.channel?.id}:message:${item.id}`}
            refreshMedia={mediaIndex => refreshLoungeMedia(item.id, mediaIndex)}
          />
          {canDeleteOwnLoungeMessage(item, site.username) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete your Lounge message"
              hitSlop={8}
              onPress={() => deleteMessage(item)}
              style={styles.messageAction}
            >
              <FontAwesome5
                name="trash-alt"
                size={10}
                color={colors.muted}
                iconStyle="solid"
              />
              <Text style={[styles.messageActionText, { color: colors.muted }]}>
                Delete
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const disabledReason = loungeSendDisabledReason(chat.channel);
  const canSend = canSendToLounge(chat.channel);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: colors.canvas }]}
    >
      <V2BrandHeader
        title="Lounge"
        subtitle="Take a break. Connect off duty."
        onSearch={() => navigation.navigate('Search')}
        onNotifications={() => navigation.navigate('NotificationCenter')}
        notificationCount={screenProps.siteManager.totalUnread()}
      />
      {!keyboardVisible ? (
        <View style={[styles.spotlight, { backgroundColor: colors.hero }]}>
          <View style={styles.spotlightCopy}>
            <View
              style={[styles.liveRule, { backgroundColor: colors.accentSoft }]}
            >
              <View
                style={[styles.liveDot, { backgroundColor: colors.success }]}
              />
              <Text style={[styles.liveLabel, { color: colors.accent }]}>
                OPEN MEMBER CHANNEL
              </Text>
            </View>
            <Text style={styles.spotlightTitle}>
              The Network’s off-duty room.
            </Text>
            <Text style={styles.spotlightBody}>
              Share the everyday conversation that keeps a professional
              community human.
            </Text>
            <View style={styles.spotlightStatus}>
              <FontAwesome5
                name="comments"
                size={13}
                color="#FFFFFF"
                iconStyle="solid"
              />
              <Text style={styles.spotlightStatusText}>Conversation open</Text>
            </View>
          </View>
          <View style={styles.spotlightVisual}>
            <View style={styles.spotlightOrbitLarge}>
              <View style={styles.spotlightIcon}>
                <FontAwesome5
                  name="comment-dots"
                  size={28}
                  color="#FFFFFF"
                  iconStyle="solid"
                />
              </View>
            </View>
            <View style={styles.spotlightOrbitSmall} />
          </View>
        </View>
      ) : null}
      <View style={styles.conversationHeading}>
        <Text style={[styles.conversationTitle, { color: colors.text }]}>
          Recent conversation
        </Text>
        <Text style={[styles.conversationMeta, { color: colors.muted }]}>
          {chat.messages.length
            ? `${chat.messages.length} recent ${
                chat.messages.length === 1 ? 'message' : 'messages'
              }`
            : 'Shared member channel'}
        </Text>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatArea}
      >
        {chat.loading ? (
          <View style={styles.feed}>
            <ContentSkeleton rows={5} />
          </View>
        ) : chat.error ? (
          <View style={[styles.feed, styles.feedState]}>
            <View
              style={[
                styles.channelStateCard,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
            >
              <InlineState
                icon="comments"
                title={
                  chat.error === 'channel_missing'
                    ? 'The Lounge is being prepared'
                    : 'Couldn’t refresh the Lounge'
                }
                body={
                  chat.error === 'channel_missing'
                    ? 'The shared member channel is not available yet.'
                    : 'Visible messages are preserved when possible. Try the connection again.'
                }
                action={
                  <Action label="Try again" onPress={loadLounge} secondary />
                }
              />
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.feedList}
            contentContainerStyle={[
              styles.feed,
              !chat.messages.length && styles.feedEmpty,
            ]}
            data={chat.messages}
            keyExtractor={item => String(item.id)}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.empty}>
                <FontAwesome5
                  name="comment"
                  size={24}
                  color={colors.accent}
                  iconStyle="solid"
                />
                <Text style={[styles.statusTitle, { color: colors.text }]}>
                  The Lounge is quiet
                </Text>
                <Text style={[styles.statusText, { color: colors.muted }]}>
                  Say hello to the Network.
                </Text>
              </View>
            }
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onContentSizeChange={() => {
              if (!didInitialScroll.current && chat.messages.length) {
                didInitialScroll.current = true;
                listRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onRefresh={refreshMessages}
            onScroll={event => {
              if (event.nativeEvent.contentOffset.y < 32) loadOlderMessages();
            }}
            refreshing={false}
            renderItem={renderMessage}
          />
        )}
        <View
          style={[
            styles.composer,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <EmojiTextInput
            accessibilityLabel="Message the Lounge"
            containerStyle={styles.emojiInput}
            editable={canSend && !composer.submitting}
            maxLength={2000}
            multiline
            onChangeText={message =>
              setComposer(current => ({ ...current, message, error: null }))
            }
            placeholder={
              canSend ? 'Message the Lounge…' : 'Messaging unavailable'
            }
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                backgroundColor: colors.canvas,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={composer.message}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={
              !canSend || composer.submitting || !composer.message.trim()
            }
            onPress={submitMessage}
            style={({ pressed }) => [
              styles.send,
              {
                backgroundColor: colors.accent,
                opacity:
                  !canSend || composer.submitting || !composer.message.trim()
                    ? 0.4
                    : pressed
                    ? 0.75
                    : 1,
              },
            ]}
          >
            {composer.submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <FontAwesome5
                name="paper-plane"
                size={16}
                color="#FFFFFF"
                iconStyle="solid"
              />
            )}
          </Pressable>
        </View>
        {composer.error || disabledReason ? (
          <Text
            accessibilityRole={composer.error ? 'alert' : 'text'}
            style={[
              styles.composerReason,
              { color: composer.error ? colors.danger : colors.muted },
            ]}
          >
            {composer.error || disabledReason}
          </Text>
        ) : null}
        <View style={{ height: keyboardVisible ? 0 : tabBarHeight }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  chatArea: { flex: 1 },
  feedList: { flex: 1 },
  spotlight: {
    minHeight: 124,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  spotlightCopy: {
    flex: 1.55,
    paddingHorizontal: 13,
    paddingVertical: 10,
    zIndex: 2,
  },
  spotlightTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '850',
    marginTop: spacing.xs,
  },
  spotlightBody: {
    color: '#C9D7E0',
    fontSize: 11,
    lineHeight: 15,
    marginTop: spacing.xxs,
  },
  spotlightStatus: {
    minHeight: 28,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: '#B3262D',
  },
  spotlightStatusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  spotlightVisual: {
    flex: 0.85,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#183C55',
  },
  spotlightOrbitLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 9,
    borderColor: 'rgba(129, 205, 220, 0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightOrbitSmall: {
    width: 38,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(129, 205, 220, 0.11)',
  },
  spotlightIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#157A96',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  conversationHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  conversationTitle: { fontSize: 17, lineHeight: 22, fontWeight: '820' },
  conversationMeta: { fontSize: 12, lineHeight: 17 },
  liveRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 0,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveLabel: { ...type.label, fontSize: 10 },
  feed: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  feedState: { flex: 1, justifyContent: 'center', paddingBottom: 120 },
  channelStateCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  feedEmpty: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  statusTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '750',
    textAlign: 'center',
  },
  statusText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  messageCopy: { flex: 1, minWidth: 0 },
  messageMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  author: { fontSize: 14, lineHeight: 19, fontWeight: '750', flexShrink: 1 },
  timestamp: { fontSize: 11, lineHeight: 16 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 2 },
  messageAction: {
    alignSelf: 'flex-start',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  messageActionText: { fontSize: 12, lineHeight: 17, fontWeight: '650' },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#07131D',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  emojiInput: { flex: 1 },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 9,
    fontSize: 16,
    lineHeight: 21,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerReason: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
});
