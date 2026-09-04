/* @flow */
'use strict';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  Linking,
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
import {
  Action,
  ContentSkeleton,
  MemberAvatar,
  V2BrandHeader,
  useProductTheme,
} from './ProductComponents';
import { radius, spacing } from './DesignSystem';
import {
  canAttemptNotificationSetup,
  notificationAttemptMessage,
  notificationSetupActionLabel,
  NOTIFICATION_STATUS,
} from '../notificationStatus';
import {
  bookmarkDeletePath,
  discussionSearchEligible,
  memberSearchResults,
  searchResults,
  supportedNotificationPreferences,
} from './memberUtilities';
import { optionLabel, stateLabel } from './adjusterCardPresentation';
import { deleteOwnAccount } from './NativeModeration';

const Shell = ({ title, navigation, children }) => {
  const colors = useProductTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <V2BrandHeader
        title={title}
        subtitle={
          title === 'Search'
            ? 'Find discussions, knowledge, and Network members.'
            : title === 'Notifications'
            ? 'Choose how Adjuster Network keeps you informed.'
            : 'Member tools and account preferences.'
        }
        onBack={() => navigation.goBack()}
      />
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
          backgroundColor: selected ? colors.accentSoft : 'transparent',
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

const MemberSearchResult = ({ member, site, onPress }) => {
  const colors = useProductTheme();
  const metadata = member.professionalMetadata || {};
  const headline =
    typeof metadata.professional_headline === 'string'
      ? metadata.professional_headline.trim()
      : '';
  const location =
    typeof metadata.base_state === 'string' && metadata.base_state
      ? stateLabel(metadata.base_state)
      : '';
  const licenses = Array.isArray(metadata.licensed_states)
    ? metadata.licensed_states.filter(Boolean).slice(0, 4)
    : [];
  const specialties = Array.isArray(metadata.specialties)
    ? metadata.specialties
        .filter(Boolean)
        .slice(0, 2)
        .map(value => optionLabel('specialties', value))
    : [];
  const details = [
    location ? `Based in ${location}` : null,
    licenses.length ? `Licensed: ${licenses.join(', ')}` : null,
    specialties.length ? specialties.join(' · ') : null,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${member.title} Adjuster Card`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.memberResult,
        {
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.accentSoft : 'transparent',
        },
      ]}
    >
      <MemberAvatar
        avatarTemplate={member.avatarTemplate}
        label={member.title || member.username}
        site={site}
        size={48}
        style={styles.memberAvatar}
        username={member.username}
      />
      <View style={styles.flex}>
        <Text style={[styles.memberName, { color: colors.text }]}>
          {member.title}
        </Text>
        <Text style={[styles.memberUsername, { color: colors.muted }]}>
          @{member.username}
        </Text>
        {headline ? (
          <Text style={[styles.memberHeadline, { color: colors.accent }]}>
            {headline}
          </Text>
        ) : null}
        {details.length ? (
          <Text style={[styles.memberMetadata, { color: colors.muted }]}>
            {details.join(' · ')}
          </Text>
        ) : null}
      </View>
      <FontAwesome5
        name="chevron-right"
        iconStyle="solid"
        size={13}
        color={colors.muted}
      />
    </Pressable>
  );
};

const SearchDiscussionResult = ({ result, onPress }) => {
  const colors = useProductTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open discussion ${result.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.searchResultRow,
        {
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.accentSoft : 'transparent',
        },
      ]}
    >
      <View
        style={[
          styles.searchResultIcon,
          { backgroundColor: colors.accentSoft },
        ]}
      >
        <FontAwesome5
          name={result.kind === 'post' ? 'comment-alt' : 'comments'}
          iconStyle="solid"
          size={15}
          color={colors.accent}
        />
      </View>
      <View style={styles.flex}>
        <Text
          numberOfLines={2}
          style={[styles.searchResultTitle, { color: colors.text }]}
        >
          {result.title}
        </Text>
        {result.detail ? (
          <Text
            numberOfLines={2}
            style={[styles.searchResultDetail, { color: colors.muted }]}
          >
            {result.detail}
          </Text>
        ) : null}
      </View>
      <FontAwesome5
        name="chevron-right"
        iconStyle="solid"
        size={13}
        color={colors.muted}
      />
    </Pressable>
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
    preferences: [],
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
        preferences: supportedNotificationPreferences(
          payload?.user?.user_option || {},
        ),
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
  const save = async (key, value) => {
    setState(current => ({ ...current, saving: true, error: null }));
    try {
      await site.jsonApi(
        `/u/${encodeURIComponent(site.username)}.json`,
        'PUT',
        { [key]: value },
      );
      setState(current => ({
        ...current,
        saving: false,
        preferences: current.preferences.map(item =>
          item.key === key ? { ...item, value } : item,
        ),
      }));
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
        {state.loading ? (
          <ContentSkeleton rows={3} />
        ) : (
          state.preferences.map(preference => (
            <View key={preference.key}>
              <Text style={[styles.heading, { color: colors.text }]}>
                {preference.title}
              </Text>
              {(typeof preference.value === 'boolean'
                ? [
                    ['On', true],
                    ['Off', false],
                  ]
                : [
                    ['Always', 0],
                    ['Only when away', 1],
                    ['Never', 2],
                  ]
              ).map(([label, value]) => (
                <Row
                  key={`${preference.key}-${label}`}
                  title={label}
                  selected={preference.value === value}
                  onPress={() => !state.saving && save(preference.key, value)}
                />
              ))}
            </View>
          ))
        )}
        {!state.loading && !state.preferences.length ? (
          <Status>No server-managed email preferences are available.</Status>
        ) : null}
        <Text style={[styles.heading, { color: colors.text }]}>
          Device notifications
        </Text>
        <Row
          title={
            screenProps.pushStatus === 'enabled'
              ? 'Enabled'
              : screenProps.pushStatus ===
                NOTIFICATION_STATUS.DEVELOPMENT_BUILD_LIMITATION
              ? 'Unavailable in development build'
              : notificationSetupActionLabel(screenProps.pushStatus)
          }
          detail="Uses this device's secure notification permission"
          onPress={
            screenProps.pushStatus === NOTIFICATION_STATUS.PERMISSION_DENIED
              ? () => Linking.openSettings()
              : canAttemptNotificationSetup(screenProps.pushStatus)
              ? screenProps.enablePush
              : undefined
          }
        />
        {screenProps.pushAttemptResult ? (
          <Text
            accessibilityRole={
              screenProps.pushAttemptResult.outcome === 'failed'
                ? 'alert'
                : 'status'
            }
            style={[
              styles.error,
              {
                color:
                  screenProps.pushAttemptResult.outcome === 'failed'
                    ? colors.danger
                    : colors.text,
              },
            ]}
          >
            {notificationAttemptMessage(screenProps.pushAttemptResult)}
          </Text>
        ) : null}
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
  const [deleting, setDeleting] = useState(false);
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
  const requestExport = () =>
    Alert.alert(
      'Request account export?',
      'Adjuster Network will prepare a private archive and notify you when it is ready. Only one archive may be requested per day.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request export',
          onPress: async () => {
            try {
              await site.jsonApi('/export_csv/export_entity.json', 'POST', {
                entity: 'user_archive',
              });
              Alert.alert(
                'Export requested',
                'You will be notified when your private archive is ready.',
              );
            } catch {
              Alert.alert(
                'Export not requested',
                'The archive may already have been requested today. Please try again later.',
              );
            }
          },
        },
      ],
    );
  const requestDeletion = () =>
    Alert.alert(
      'Delete your account?',
      'This requests permanent deletion of your Adjuster Network account, profile, and posts. Data that must be retained for legal, security, or moderation obligations may be kept as described in the Privacy Policy. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteOwnAccount(site);
              Alert.alert(
                'Account deleted',
                'Your Adjuster Network account deletion was completed.',
                [
                  {
                    text: 'OK',
                    onPress: () => screenProps.siteManager.remove(site),
                  },
                ],
              );
            } catch (error) {
              const detail =
                error?.userMessages?.length > 0
                  ? error.userMessages.join(' ')
                  : error?.status === 403 || error?.status === 422
                  ? 'The server could not complete deletion automatically. Your account remains active. Contact support for help with the deletion request.'
                  : 'The deletion request could not be completed. Your account remains active. Check your connection and try again.';
              Alert.alert('Account not deleted', detail);
            } finally {
              setDeleting(false);
            }
          },
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
          title="Export my data"
          detail="Request a private account archive"
          onPress={requestExport}
        />
        <Row
          title={deleting ? 'Deleting account…' : 'Delete my account'}
          detail="Permanently delete this account and its associated data"
          onPress={deleting ? undefined : requestDeletion}
        />
        <Row
          title="Privacy Policy"
          detail="How Adjuster Network handles member data"
          onPress={() => Linking.openURL('https://adjusternetwork.org/privacy')}
        />
        <Row
          title="Terms of Service"
          detail="Terms governing use of the Network"
          onPress={() => Linking.openURL('https://adjusternetwork.org/tos')}
        />
        <Row
          title="Community Rules"
          detail="Standards for professional member conduct"
          onPress={() =>
            Linking.openURL('https://adjusternetwork.org/guidelines')
          }
        />
        <Row
          title="Support"
          detail="Contact Adjuster Network support"
          onPress={() => Linking.openURL('https://adjusternetwork.org/support')}
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
  const [filter, setFilter] = useState('all');
  const [state, setState] = useState({
    loading: false,
    searched: false,
    contentResults: [],
    memberResults: [],
    contentError: null,
    memberError: null,
  });
  const search = async () => {
    const term = query.trim();
    if (!term) return;
    Keyboard.dismiss();
    setState({
      loading: true,
      searched: true,
      contentResults: [],
      memberResults: [],
      contentError: null,
      memberError: null,
    });
    const [contentResponse, memberResponse] = await Promise.allSettled([
      discussionSearchEligible(term)
        ? site.jsonApi(`/search.json?q=${encodeURIComponent(term)}`)
        : Promise.resolve({ topics: [], posts: [], users: [] }),
      site.jsonApi(
        `/native/v1/member-search?q=${encodeURIComponent(term)}&limit=10`,
      ),
    ]);
    let contentResults = [];
    let memberResults = [];
    let contentError = null;
    let memberError = null;
    if (contentResponse.status === 'fulfilled') {
      try {
        contentResults = searchResults(contentResponse.value).filter(
          result => result.kind !== 'user',
        );
      } catch {
        contentError = 'Discussion search returned an unsupported response.';
      }
    } else {
      contentError = 'Discussion search is temporarily unavailable.';
    }
    if (memberResponse.status === 'fulfilled') {
      try {
        memberResults = memberSearchResults(memberResponse.value);
      } catch {
        memberError = 'Member search returned an unsupported response.';
      }
    } else {
      memberError = 'Member search is temporarily unavailable.';
    }
    setState({
      loading: false,
      searched: true,
      contentResults,
      memberResults,
      contentError,
      memberError,
    });
  };
  const showContent = filter !== 'members';
  const showMembers = filter !== 'discussions';
  const visibleCount =
    (showContent ? state.contentResults.length : 0) +
    (showMembers ? state.memberResults.length : 0);
  const visibleError =
    (showContent && state.contentError) || (showMembers && state.memberError);
  const emptyMessage =
    filter === 'members'
      ? 'No matching Network members were found.'
      : filter === 'discussions'
      ? 'No matching discussions were found.'
      : 'No matching members or discussions were found.';
  return (
    <Shell title="Search" navigation={navigation}>
      <View style={styles.searchBar}>
        <View
          style={[
            styles.searchInputWrap,
            {
              borderColor: colors.border,
              backgroundColor: colors.surfaceRaised,
            },
          ]}
        >
          <FontAwesome5
            name="search"
            iconStyle="solid"
            size={17}
            color={colors.muted}
          />
          <TextInput
            accessibilityLabel="Search the Network"
            placeholder="Search Adjuster Network"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            style={[styles.input, styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              onPress={() => {
                setQuery('');
                setState(current => ({
                  ...current,
                  searched: false,
                  contentResults: [],
                  memberResults: [],
                  contentError: null,
                  memberError: null,
                }));
              }}
              style={styles.searchInputAction}
            >
              <FontAwesome5
                name="times-circle"
                iconStyle="solid"
                size={17}
                color={colors.muted}
              />
            </Pressable>
          ) : (
            <View style={styles.searchInputAction} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit search"
            accessibilityState={{
              disabled: !query.trim() || state.loading,
            }}
            disabled={!query.trim() || state.loading}
            onPress={search}
            style={({ pressed }) => [
              styles.searchSubmit,
              {
                backgroundColor:
                  query.trim() && !state.loading
                    ? colors.hero
                    : colors.surfaceAlt,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <FontAwesome5
              name="arrow-right"
              iconStyle="solid"
              size={14}
              color={
                query.trim() && !state.loading ? colors.onHero : colors.muted
              }
            />
          </Pressable>
        </View>
        <View
          accessibilityRole="tablist"
          style={[styles.searchFilters, { borderColor: colors.border }]}
        >
          {[
            ['all', 'All'],
            ['discussions', 'Discussions'],
            ['members', 'Members'],
          ].map(([value, label]) => {
            const selected = filter === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label} search results`}
                onPress={() => setFilter(value)}
                style={[
                  styles.searchFilter,
                  { backgroundColor: selected ? colors.text : 'transparent' },
                ]}
              >
                <Text
                  style={[
                    styles.searchFilterText,
                    { color: selected ? colors.canvas : colors.muted },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={styles.searchResultsScroll}
        contentContainerStyle={styles.content}
      >
        {!state.loading && !state.searched ? (
          <View
            style={[
              styles.searchWelcome,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.searchWelcomeTop}>
              <View
                style={[
                  styles.searchWelcomeIcon,
                  { backgroundColor: colors.accentSoft },
                ]}
              >
                <FontAwesome5
                  name="search"
                  iconStyle="solid"
                  size={18}
                  color={colors.accent}
                />
              </View>
              <View style={styles.flex}>
                <Text
                  style={[styles.searchWelcomeTitle, { color: colors.text }]}
                >
                  Search the whole Network
                </Text>
                <Text
                  style={[styles.searchWelcomeBody, { color: colors.muted }]}
                >
                  Find professional discussions and member Adjuster Cards.
                </Text>
              </View>
            </View>
            <View style={styles.searchScopeRow}>
              {[
                ['comments', 'Discussions'],
                ['user', 'Members'],
              ].map(([icon, label]) => (
                <View
                  key={label}
                  style={[styles.searchScope, { borderColor: colors.border }]}
                >
                  <FontAwesome5
                    name={icon}
                    iconStyle="solid"
                    size={13}
                    color={colors.accent}
                  />
                  <Text
                    style={[styles.searchScopeText, { color: colors.text }]}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {state.loading ? <ContentSkeleton rows={4} /> : null}
        {!state.loading && showMembers && state.memberResults.length ? (
          <View>
            <Text style={[styles.resultSection, { color: colors.brandAccent }]}>
              MEMBERS
            </Text>
            <View
              style={[
                styles.searchResultsPanel,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
            >
              {state.memberResults.map(member => (
                <MemberSearchResult
                  key={member.key}
                  member={member}
                  site={site}
                  onPress={() =>
                    screenProps.openUrl(`${site.url}${member.path}`)
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
        {!state.loading && showContent && state.contentResults.length ? (
          <View>
            <Text style={[styles.resultSection, { color: colors.brandAccent }]}>
              DISCUSSIONS
            </Text>
            <View
              style={[
                styles.searchResultsPanel,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
            >
              {state.contentResults.map(result => (
                <SearchDiscussionResult
                  key={result.key}
                  result={result}
                  onPress={() =>
                    screenProps.openUrl(`${site.url}${result.path}`)
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
        {!state.loading && state.searched && !visibleCount && !visibleError ? (
          <View
            style={[
              styles.searchEmpty,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.searchWelcomeIcon,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <FontAwesome5
                name="search"
                iconStyle="solid"
                size={18}
                color={colors.accent}
              />
            </View>
            <Text style={[styles.searchEmptyTitle, { color: colors.text }]}>
              No matches yet
            </Text>
            <Text style={[styles.searchEmptyBody, { color: colors.muted }]}>
              {emptyMessage}
            </Text>
          </View>
        ) : null}
        {!state.loading && showMembers && state.memberError ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: colors.danger }]}
          >
            {state.memberError}
          </Text>
        ) : null}
        {!state.loading && showContent && state.contentError ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: colors.danger }]}
          >
            {state.contentError}
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
  const remove = item =>
    Alert.alert(
      'Remove bookmark?',
      'This removes the saved item from your bookmarks.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await site.jsonApi(bookmarkDeletePath(item.id), 'DELETE');
              setState(current => ({
                ...current,
                items: current.items.filter(
                  candidate => candidate.id !== item.id,
                ),
              }));
            } catch {
              setState(current => ({
                ...current,
                error: 'Bookmark could not be removed.',
              }));
            }
          },
        },
      ],
    );
  return (
    <Shell title="Bookmarks" navigation={navigation}>
      <ScrollView contentContainerStyle={styles.content}>
        {state.loading ? (
          <ContentSkeleton rows={4} />
        ) : (
          state.items.map((item, index) => (
            <View
              key={item.id || `${item.topic_id}-${index}`}
              style={styles.bookmarkRow}
            >
              <View style={styles.flex}>
                <Row
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
              </View>
              {item.id ? (
                <Action label="Remove" secondary onPress={() => remove(item)} />
              ) : null}
            </View>
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
  utilityIdentity: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  utilityEyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.05,
  },
  utilityTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '820',
    marginTop: spacing.xxs,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
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
  searchWelcome: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: spacing.md,
  },
  searchWelcomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchWelcomeIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWelcomeTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800' },
  searchWelcomeBody: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  searchScopeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  searchScope: {
    flex: 1,
    minHeight: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  searchScopeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '750',
    textAlign: 'center',
  },
  error: { fontSize: 14, lineHeight: 20, marginVertical: spacing.md },
  searchBar: { padding: spacing.md, gap: spacing.md },
  searchResultsScroll: { flex: 1, marginTop: spacing.sm },
  searchInputWrap: {
    flex: 1,
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { flex: 1, borderWidth: 0, paddingHorizontal: 0 },
  searchInputAction: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSubmit: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFilters: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    padding: 3,
    flexDirection: 'row',
    gap: 2,
  },
  searchFilter: {
    flex: 1,
    minHeight: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFilterText: { fontSize: 13, lineHeight: 17, fontWeight: '750' },
  resultSection: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.05,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  searchResultsPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  searchResultRow: {
    minHeight: 76,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchResultIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultTitle: { fontSize: 15, lineHeight: 20, fontWeight: '780' },
  searchResultDetail: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  searchEmpty: {
    minHeight: 190,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmptyTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  searchEmptyBody: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  memberResult: {
    minHeight: 88,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarInitial: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  memberName: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  memberUsername: { fontSize: 13, lineHeight: 17, marginTop: 1 },
  memberHeadline: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 4,
  },
  memberMetadata: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  bookmarkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
