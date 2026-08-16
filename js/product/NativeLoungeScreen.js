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
  NotificationBell,
  PageHeader,
  useProductTheme,
} from './ProductComponents';
import { activeMemberSite } from './ProductData';
import { radius, spacing, type } from './DesignSystem';
import EmojiTextInput from './EmojiTextInput';
import {
  canSendToLounge,
  canDeleteOwnLoungeMessage,
  findLoungeChannel,
  loungeMessagesPath,
  loungeSendDisabledReason,
  mergeChatMessages,
  normalizeChatMessages,
} from './LoungeChat';

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
      await site.jsonApi(`/chat/${chat.channel.id}.json`, 'POST', { message });
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
      <View style={styles.message}>
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
        <View style={styles.messageCopy}>
          <View style={styles.messageMeta}>
            <Text style={[styles.author, { color: colors.text }]}>
              {user.name || user.username || 'Member'}
            </Text>
            <Text style={[styles.timestamp, { color: colors.muted }]}>
              {timestamp}
            </Text>
          </View>
          <Text selectable style={[styles.body, { color: colors.text }]}>
            {body}
          </Text>
          {canDeleteOwnLoungeMessage(item, site.username) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete your Lounge message"
              hitSlop={8}
              onPress={() => deleteMessage(item)}
              style={styles.messageAction}
            >
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
      <PageHeader
        eyebrow="Members"
        title="The Lounge"
        action={
          <NotificationBell
            count={screenProps.siteManager.totalUnread()}
            onPress={() => navigation.navigate('NotificationCenter')}
          />
        }
      />
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Open conversation for Network members.
      </Text>
      <View style={[styles.liveRule, { backgroundColor: colors.accentSoft }]}>
        <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
        <Text style={[styles.liveLabel, { color: colors.accent }]}>
          SHARED MEMBER CHANNEL
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
          <View style={styles.feed}>
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
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginHorizontal: spacing.md,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  liveRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
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
    borderBottomWidth: 0,
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
