/* @flow */
'use strict';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activeMemberSite } from './ProductData';
import { Action, NestedHeader, useProductTheme } from './ProductComponents';
import { radius, spacing } from './DesignSystem';

const Shell = ({ title, navigation, children }) => {
  const colors = useProductTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <NestedHeader title={title} onBack={() => navigation.goBack()} />
      {children}
    </SafeAreaView>
  );
};

const Row = ({ title, detail, selected = false, onPress }) => {
  const colors = useProductTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={title}
      accessibilityState={selected ? { selected: true } : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {detail ? (
          <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text>
        ) : null}
      </View>
      {selected ? (
        <FontAwesome5
          name="check"
          iconStyle="solid"
          size={15}
          color={colors.accent}
        />
      ) : onPress ? (
        <FontAwesome5
          name="chevron-right"
          iconStyle="solid"
          size={13}
          color={colors.muted}
        />
      ) : null}
    </Pressable>
  );
};

const Status = ({ children }) => {
  const colors = useProductTheme();
  return (
    <Text style={[styles.status, { color: colors.muted }]}>{children}</Text>
  );
};

export function AccountScreen({ navigation, screenProps }) {
  const site = activeMemberSite(screenProps.siteManager);
  return (
    <Shell title="Account" navigation={navigation}>
      <ScrollView contentContainerStyle={styles.content}>
        <Row
          title={site?.username ? `@${site.username}` : 'Member account'}
          detail="Authenticated Adjuster Network member"
        />
        <Row
          title="Profile"
          detail="View contributions and edit permitted profile fields"
          onPress={() =>
            navigation.navigate('MemberProfile', { username: site?.username })
          }
        />
        <Status>
          Your sign-in credential is held in secure native storage on this
          device.
        </Status>
      </ScrollView>
    </Shell>
  );
}

export function NotificationSettingsScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const [state, setState] = useState({
    loading: true,
    saving: false,
    emailLevel: null,
    error: null,
  });
  const load = useCallback(async () => {
    if (!site?.username) return;
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const payload = await site.jsonApi(
        `/u/${encodeURIComponent(site.username)}.json`,
      );
      setState({
        loading: false,
        saving: false,
        emailLevel: payload?.user?.user_option?.email_level ?? 0,
        error: null,
      });
    } catch {
      setState(current => ({
        ...current,
        loading: false,
        error: 'Notification preferences could not be loaded.',
      }));
    }
  }, [site]);
  useEffect(() => {
    load();
  }, [load]);
  const save = async emailLevel => {
    setState(current => ({ ...current, saving: true, error: null }));
    try {
      await site.jsonApi(
        `/u/${encodeURIComponent(site.username)}.json`,
        'PUT',
        { email_level: emailLevel },
      );
      setState(current => ({ ...current, saving: false, emailLevel }));
    } catch {
      setState(current => ({
        ...current,
        saving: false,
        error: 'Notification preference could not be saved.',
      }));
    }
  };
  return (
    <Shell title="Notifications" navigation={navigation}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: colors.text }]}>
          Email for topic activity
        </Text>
        {state.loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          [
            ['Always', 0],
            ['Only when away', 1],
            ['Never', 2],
          ].map(([label, value]) => (
            <Row
              key={label}
              title={label}
              selected={state.emailLevel === value}
              onPress={() => !state.saving && save(value)}
            />
          ))
        )}
        <Text style={[styles.heading, { color: colors.text }]}>
          Device notifications
        </Text>
        <Row
          title={
            screenProps.pushStatus === 'enabled'
              ? 'Enabled'
              : 'Enable notifications'
          }
          detail="Uses this device's secure notification permission"
          onPress={
            screenProps.pushStatus === 'enabled'
              ? undefined
              : screenProps.enablePush
          }
        />
        {state.saving ? <Status>Saving…</Status> : null}
        {state.error ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: colors.danger }]}
          >
            {state.error}
          </Text>
        ) : null}
      </ScrollView>
    </Shell>
  );
}

export function AppearanceSettingsScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const selected = screenProps.themePreference || 'system';
  return (
    <Shell title="Appearance" navigation={navigation}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: colors.muted }]}>
          Choose how Adjuster Network appears on this device.
        </Text>
        {['system', 'light', 'dark'].map(value => (
          <Row
            key={value}
            title={
              value === 'system'
                ? 'System'
                : value[0].toUpperCase() + value.slice(1)
            }
            selected={selected === value}
            onPress={() => screenProps.setThemePreference(value)}
          />
        ))}
      </ScrollView>
    </Shell>
  );
}

export function PrivacyAccountScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const confirmLogout = () =>
    Alert.alert(
      'Log out?',
      'This removes the member session from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => screenProps.siteManager.remove(site),
        },
      ],
    );
  return (
    <Shell title="Privacy & Account" navigation={navigation}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: colors.text }]}>
          Private by design
        </Text>
        <Text style={[styles.intro, { color: colors.muted }]}>
          Authentication stays in secure native storage. Do not post claim
          numbers, policy details, addresses, documents, or identifying claim
          data.
        </Text>
        <Row
          title="Account deletion"
          detail="Account deletion is not available in the Build 1 native member experience. Contact Network support for a reviewed request."
        />
        <Action
          label="Log out of this device"
          secondary
          onPress={confirmLogout}
        />
      </ScrollView>
    </Shell>
  );
}

export function NativeSearchScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const [query, setQuery] = useState('');
  const [state, setState] = useState({
    loading: false,
    searched: false,
    topics: [],
    error: null,
  });
  const search = async () => {
    const term = query.trim();
    if (!term) return;
    setState({ loading: true, searched: true, topics: [], error: null });
    try {
      const payload = await site.jsonApi(
        `/search.json?q=${encodeURIComponent(term)}`,
      );
      setState({
        loading: false,
        searched: true,
        topics: payload?.topics || [],
        error: null,
      });
    } catch {
      setState({
        loading: false,
        searched: true,
        topics: [],
        error: 'Search could not be completed.',
      });
    }
  };
  return (
    <Shell title="Search" navigation={navigation}>
      <View style={styles.searchBar}>
        <TextInput
          accessibilityLabel="Search the Network"
          placeholder="Search discussions and members"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        />
        <Action
          label="Search"
          onPress={search}
          disabled={!query.trim() || state.loading}
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {state.loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          state.topics.map(topic => (
            <Row
              key={topic.id}
              title={topic.title || 'Discussion'}
              detail={`${topic.posts_count || 0} posts`}
              onPress={() =>
                screenProps.openUrl(
                  `${site.url}/t/${topic.slug || 'topic'}/${topic.id}`,
                )
              }
            />
          ))
        )}
        {!state.loading &&
        state.searched &&
        !state.topics.length &&
        !state.error ? (
          <Status>No matching member content was found.</Status>
        ) : null}
        {state.error ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: colors.danger }]}
          >
            {state.error}
          </Text>
        ) : null}
      </ScrollView>
    </Shell>
  );
}

export function NativeBookmarksScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const [state, setState] = useState({ loading: true, items: [], error: null });
  const load = useCallback(async () => {
    if (!site?.username) return;
    try {
      const payload = await site.jsonApi(
        `/u/${encodeURIComponent(site.username)}/activity/bookmarks.json`,
      );
      setState({
        loading: false,
        items:
          payload?.user_bookmark_list?.bookmarks || payload?.bookmarks || [],
        error: null,
      });
    } catch {
      setState({
        loading: false,
        items: [],
        error: 'Bookmarks could not be loaded.',
      });
    }
  }, [site]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <Shell title="Bookmarks" navigation={navigation}>
      <ScrollView contentContainerStyle={styles.content}>
        {state.loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          state.items.map((item, index) => (
            <Row
              key={item.id || `${item.topic_id}-${index}`}
              title={item.title || item.topic_title || 'Saved discussion'}
              detail={item.name || 'Bookmarked content'}
              onPress={
                item.topic_id
                  ? () =>
                      screenProps.openUrl(
                        `${site.url}/t/topic/${item.topic_id}${
                          item.post_number ? `/${item.post_number}` : ''
                        }`,
                      )
                  : undefined
              }
            />
          ))
        )}
        {!state.loading && !state.items.length && !state.error ? (
          <Status>You have no saved discussions yet.</Status>
        ) : null}
        {state.error ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: colors.danger }]}
          >
            {state.error}
          </Text>
        ) : null}
      </ScrollView>
    </Shell>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  intro: { fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  heading: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  row: {
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  detail: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  status: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  error: { fontSize: 14, lineHeight: 20, marginVertical: spacing.md },
  searchBar: { padding: spacing.md, gap: spacing.sm },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
});
