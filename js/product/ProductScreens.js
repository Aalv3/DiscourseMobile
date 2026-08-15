/* @flow */
'use strict';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import { useAssets } from 'expo-asset';
import {
  Action,
  Card,
  NotificationBell,
  PageHeader,
  Pill,
  SectionTitle,
  StateCard,
  useProductTheme,
} from './ProductComponents';
import {
  activeMemberSite,
  askableCategories,
  loadCommunity,
  topicPath,
} from './ProductData';
import { radius, spacing } from './DesignSystem';
import { adjusterNetwork } from '../adjusterNetworkConfig';
export { default as LoungeScreen } from './NativeLoungeScreen';
import EmojiTextInput from './EmojiTextInput';
import { parseAdjusterCard } from '../adjusterCardClient';

const Screen = ({ children }) => {
  const colors = useProductTheme();
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.canvas }]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safe}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const HeaderActions = ({ navigation, screenProps, search = false }) => {
  const colors = useProductTheme();
  return (
    <View style={styles.headerActions}>
      {search ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search the Network"
          hitSlop={8}
          onPress={() => navigation.navigate('Search')}
          style={[styles.headerAction, { borderColor: colors.border }]}
        >
          <FontAwesome5
            name="search"
            size={17}
            color={colors.accent}
            iconStyle="solid"
          />
        </Pressable>
      ) : null}
      <NotificationBell
        count={screenProps.siteManager.totalUnread()}
        onPress={() => navigation.navigate('NotificationCenter')}
      />
    </View>
  );
};

export function WelcomeScreen({ onConnect, onLogin, busy }) {
  const colors = useProductTheme();
  const { width } = useWindowDimensions();
  const [brandAssets] = useAssets([
    require('../../img/adjuster-network-logo.png'),
  ]);
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safe}
      >
        <ScrollView
          contentContainerStyle={[
            styles.welcome,
            width >= 700 && styles.welcomeWide,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandLogoPlate}>
            <Image
              source={
                brandAssets?.[0]?.localUri
                  ? { uri: brandAssets[0].localUri }
                  : undefined
              }
              style={styles.brandLogo}
              resizeMode="contain"
              accessible
              accessibilityRole="image"
              accessibilityLabel="Adjuster Network"
            />
          </View>
          <Text
            accessibilityRole="header"
            style={[styles.welcomeTitle, { color: colors.text }]}
          >
            The private professional network built for adjusters.
          </Text>
          <Text style={[styles.welcomeBody, { color: colors.muted }]}>
            Trade field knowledge, ask better questions, and keep up with
            claims—without putting claim data in public view.
          </Text>
          <View
            style={[styles.valueCard, { backgroundColor: colors.surfaceAlt }]}
          >
            <Value
              icon="user-shield"
              title="Members only"
              body="Professional conversation stays inside the network."
            />
            <Value
              icon="handshake"
              title="Free membership"
              body="Connect with peers across the claims community."
            />
            <Value
              icon="clipboard-check"
              title="Useful by design"
              body="Claims intelligence, practical knowledge, and focused discussions."
            />
          </View>
          <Action
            label={busy ? 'Connecting…' : 'Connect free'}
            icon="arrow-right"
            onPress={onConnect}
            disabled={busy}
          />
          <Action label="Log in" onPress={onLogin} secondary disabled={busy} />
          <Text style={[styles.finePrint, { color: colors.muted }]}>
            Never post names, policy numbers, addresses, photos, or other
            claim-identifying information.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Value = ({ icon, title, body }) => {
  const colors = useProductTheme();
  return (
    <View style={styles.value}>
      <FontAwesome5
        name={icon}
        size={18}
        color={colors.accent}
        iconStyle="solid"
      />
      <View style={styles.valueCopy}>
        <Text style={[styles.valueTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.valueBody, { color: colors.muted }]}>{body}</Text>
      </View>
    </View>
  );
};

function useCommunity(siteManager, contentVersion) {
  const [state, setState] = useState({
    loading: true,
    error: false,
    topics: [],
    categories: [],
  });
  const refresh = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: false }));
    try {
      setState({
        loading: false,
        error: false,
        ...(await loadCommunity(activeMemberSite(siteManager))),
      });
    } catch {
      setState(current => ({ ...current, loading: false, error: true }));
    }
  }, [contentVersion, siteManager]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { ...state, refresh };
}

const TopicCard = ({ topic, site, openUrl }) => {
  const colors = useProductTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open discussion: ${topic.title}`}
      onPress={() => openUrl(`${site.url}${topicPath(topic)}`)}
      style={({ pressed }) => [
        styles.topic,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.topicCopy}>
        <Text
          numberOfLines={2}
          style={[styles.topicTitle, { color: colors.text }]}
        >
          {topic.title}
        </Text>
        <Text style={[styles.topicMeta, { color: colors.muted }]}>
          Open conversation · {topic.views || 0} views
        </Text>
      </View>
      <FontAwesome5
        name="chevron-right"
        size={14}
        color={colors.muted}
        iconStyle="solid"
      />
    </Pressable>
  );
};

export function FloorScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const data = useCommunity(
    screenProps.siteManager,
    screenProps.memberContentVersion,
  );
  return (
    <Screen>
      <PageHeader
        eyebrow="Member briefing"
        title="The Floor"
        action={
          <HeaderActions
            navigation={navigation}
            screenProps={screenProps}
            search
          />
        }
      />
      <View style={[styles.hero, { backgroundColor: colors.hero }]}>
        <Text style={styles.heroKicker}>TODAY IN CLAIMS</Text>
        <Text style={styles.heroTitle}>
          Your daily briefing is ready when approved intelligence is available.
        </Text>
        <Text style={styles.heroBody}>
          No summary has been published yet. We’ll show source-backed updates
          here—not filler.
        </Text>
      </View>
      <View style={styles.twoCol}>
        <Card style={styles.flexCard}>
          <Text style={[styles.cardKicker, { color: colors.accent }]}>
            CLAIMS WEATHER
          </Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            No active snapshot
          </Text>
          <Text style={[styles.cardBody, { color: colors.muted }]}>
            A compact CAT and weather view will appear when the approved feed
            reports an update.
          </Text>
        </Card>
        <Card style={styles.flexCard}>
          <Text style={[styles.cardKicker, { color: colors.accent }]}>
            FIELD KNOWLEDGE
          </Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Build the playbook
          </Text>
          <Text style={[styles.cardBody, { color: colors.muted }]}>
            Practical, reviewed field guidance will live here as members
            contribute it.
          </Text>
        </Card>
      </View>
      <SectionTitle
        title="Relevant discussions"
        detail="Recent member conversations from the network."
      />
      {data.loading ? (
        <StateCard
          loading
          title="Loading the Floor"
          body="Checking the private network for recent discussions."
        />
      ) : data.error ? (
        <StateCard
          icon="triangle-exclamation"
          title="Couldn’t refresh"
          body="Your private content remains hidden. Try again when your connection is available."
          action={<Action label="Try again" onPress={data.refresh} secondary />}
        />
      ) : data.topics.length ? (
        data.topics
          .slice(0, 4)
          .map(topic => (
            <TopicCard
              key={topic.id}
              topic={topic}
              site={site}
              openUrl={screenProps.openUrl}
            />
          ))
      ) : (
        <StateCard
          title="The Floor is quiet"
          body="There are no recent discussions to show yet. Start with a useful question when you’re ready."
        />
      )}
    </Screen>
  );
}

export function DiscussionsScreen({ navigation, screenProps }) {
  const site = activeMemberSite(screenProps.siteManager);
  const data = useCommunity(
    screenProps.siteManager,
    screenProps.memberContentVersion,
  );
  const [filter, setFilter] = useState('All');
  const categories = [
    'All',
    'Unanswered',
    ...data.categories.slice(0, 5).map(c => c.name),
  ];
  const visible = useMemo(
    () =>
      data.topics.filter(
        topic =>
          filter === 'All' ||
          (filter === 'Unanswered'
            ? (topic.posts_count || 1) <= 1
            : topic.category_id ===
              data.categories.find(c => c.name === filter)?.id),
      ),
    [data, filter],
  );
  return (
    <Screen>
      <PageHeader
        eyebrow="Members only"
        title="Discussions"
        action={
          <HeaderActions navigation={navigation} screenProps={screenProps} />
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}
      >
        {categories.map(item => (
          <Pill
            key={item}
            label={item}
            selected={filter === item}
            onPress={() => setFilter(item)}
          />
        ))}
      </ScrollView>
      {data.loading ? (
        <StateCard
          loading
          title="Loading discussions"
          body="Fetching private member conversations."
        />
      ) : data.error ? (
        <StateCard
          icon="triangle-exclamation"
          title="Discussions unavailable"
          body="We couldn’t reach the network. Nothing cached is being presented as current."
          action={<Action label="Try again" onPress={data.refresh} secondary />}
        />
      ) : visible.length ? (
        visible.map(topic => (
          <TopicCard
            key={topic.id}
            topic={topic}
            site={site}
            openUrl={screenProps.openUrl}
          />
        ))
      ) : (
        <StateCard
          icon="comments"
          title="Nothing here yet"
          body={
            filter === 'Unanswered'
              ? 'No unanswered discussions are available.'
              : 'This category does not have any discussions yet.'
          }
        />
      )}
    </Screen>
  );
}

export function AskScreen({ navigation, route, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const data = useCommunity(
    screenProps.siteManager,
    screenProps.memberContentVersion,
  );
  const permittedCategories = askableCategories(data.categories);
  const [category, setCategory] = useState(null);
  const [question, setQuestion] = useState({
    title: '',
    raw: '',
    submitting: false,
    error: null,
  });
  useEffect(() => {
    const sharedText = route?.params?.sharedText;
    if (typeof sharedText === 'string' && sharedText.trim()) {
      setQuestion(current => ({
        ...current,
        raw: sharedText.slice(0, 8192),
      }));
      navigation.setParams({ sharedText: undefined, shareIntentId: undefined });
    }
  }, [navigation, route?.params?.shareIntentId, route?.params?.sharedText]);
  const submitQuestion = async () => {
    if (!site?.authToken || !category) return;
    setQuestion(current => ({ ...current, submitting: true, error: null }));
    try {
      const created = await site.jsonApi('/posts.json', 'POST', {
        title: question.title.trim(),
        raw: question.raw.trim(),
        category: category.id,
      });
      setQuestion({ title: '', raw: '', submitting: false, error: null });
      data.refresh();
      if (created?.topic_id) {
        screenProps.openUrl(
          `${site.url}/t/${created.topic_slug || 'topic'}/${created.topic_id}`,
        );
      }
    } catch (error) {
      setQuestion(current => ({
        ...current,
        submitting: false,
        error:
          error?.userMessages?.join(' ') ||
          (error?.status === 403
            ? 'Your account is not permitted to ask in this category.'
            : 'Your question could not be posted. Please try again.'),
      }));
    }
  };
  return (
    <Screen>
      <PageHeader
        eyebrow="A better question gets a better answer"
        title="Ask the Network"
        action={
          <HeaderActions navigation={navigation} screenProps={screenProps} />
        }
      />
      <Card style={[styles.safety, { backgroundColor: colors.accentSoft }]}>
        <FontAwesome5
          name="shield-alt"
          size={22}
          color={colors.accent}
          iconStyle="solid"
        />
        <View style={styles.safetyCopy}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Keep claim data out
          </Text>
          <Text style={[styles.cardBody, { color: colors.muted }]}>
            Do not include names, addresses, policy or claim numbers, photos,
            documents, or facts that could identify a person or claim.
          </Text>
        </View>
      </Card>
      <SectionTitle
        title="Choose a category"
        detail="This keeps your question in front of the right members."
      />
      <View style={styles.categoryGrid}>
        {permittedCategories.map(item => (
          <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: category?.id === item.id }}
            onPress={() => setCategory(item)}
            style={[
              styles.category,
              {
                backgroundColor:
                  category?.id === item.id ? colors.accentSoft : colors.surface,
                borderColor:
                  category?.id === item.id ? colors.accent : colors.border,
              },
            ]}
          >
            <Text style={[styles.categoryTitle, { color: colors.text }]}>
              {item.name}
            </Text>
            {item.description_text ? (
              <Text
                numberOfLines={2}
                style={[styles.cardBody, { color: colors.muted }]}
              >
                {item.description_text}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      {!data.loading && !permittedCategories.length ? (
        <StateCard
          icon="folder-open"
          title="Asking is unavailable"
          body="Your account is not currently permitted to create a discussion in an available category."
        />
      ) : null}
      <SectionTitle
        title="Your question"
        detail="Give members enough professional context to help without including claim-identifying information."
      />
      <EmojiTextInput
        accessibilityLabel="Question title"
        editable={!question.submitting}
        maxLength={255}
        onChangeText={title =>
          setQuestion(current => ({ ...current, title, error: null }))
        }
        placeholder="What would you like help with?"
        placeholderTextColor={colors.muted}
        style={[
          styles.composerTitleInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        value={question.title}
      />
      <EmojiTextInput
        accessibilityLabel="Question details"
        editable={!question.submitting}
        multiline
        onChangeText={raw =>
          setQuestion(current => ({ ...current, raw, error: null }))
        }
        placeholder="Add useful context for other adjusters…"
        placeholderTextColor={colors.muted}
        style={[
          styles.composerBodyInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        textAlignVertical="top"
        value={question.raw}
      />
      {question.error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.composerError, { color: colors.danger }]}
        >
          {question.error}
        </Text>
      ) : null}
      <Action
        label={question.submitting ? 'Posting…' : 'Ask the Network'}
        icon="pen"
        disabled={
          question.submitting ||
          !category ||
          !question.title.trim() ||
          !question.raw.trim()
        }
        onPress={submitQuestion}
      />
      <Text style={[styles.finePrint, { color: colors.muted }]}>
        Your post is members-only under the network’s current access rules.
        Review it once more before publishing.
      </Text>
    </Screen>
  );
}

export function IntelligenceScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const rows = [
    {
      icon: 'newspaper',
      title: 'Today in Claims',
      body: 'A concise source-backed daily briefing.',
      path: '/tag/today-in-claims',
    },
    {
      icon: 'cloud-bolt',
      title: 'Claims Weather',
      body: 'Compact CAT and weather context for field decisions.',
      path: '/tag/claims-weather',
    },
    {
      icon: 'toolbox',
      title: 'Field Knowledge',
      body: 'Practical methods contributed by working adjusters.',
      path: '/tag/field-knowledge',
    },
  ];
  return (
    <Screen>
      <PageHeader
        eyebrow="Signal, not noise"
        title="Intelligence"
        action={
          <HeaderActions navigation={navigation} screenProps={screenProps} />
        }
      />
      <Text style={[styles.intro, { color: colors.muted }]}>
        Native-friendly briefings and field knowledge. Detailed map work stays
        on the web where it fits.
      </Text>
      {rows.map(row => (
        <Pressable
          key={row.title}
          accessibilityRole="link"
          onPress={() => screenProps.openUrl(`${site.url}${row.path}`)}
          style={({ pressed }) => [
            styles.intel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View
            style={[styles.intelIcon, { backgroundColor: colors.accentSoft }]}
          >
            <FontAwesome5
              name={row.icon}
              size={20}
              color={colors.accent}
              iconStyle="solid"
            />
          </View>
          <View style={styles.topicCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {row.title}
            </Text>
            <Text style={[styles.cardBody, { color: colors.muted }]}>
              {row.body}
            </Text>
            <Text style={[styles.available, { color: colors.accent }]}>
              Open current collection
            </Text>
          </View>
          <FontAwesome5
            name="chevron-right"
            size={14}
            color={colors.muted}
            iconStyle="solid"
          />
        </Pressable>
      ))}
    </Screen>
  );
}

export function ProfileScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const username = site?.username || 'Member';
  const [adjusterCard, setAdjusterCard] = useState(null);
  useEffect(() => {
    let mounted = true;
    if (site?.authToken) {
      site
        .jsonApi('/native/v1/profile')
        .then(payload => {
          if (mounted) setAdjusterCard(parseAdjusterCard(payload));
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [site]);
  return (
    <Screen>
      <PageHeader
        eyebrow="Private member account"
        title="You"
        action={
          <HeaderActions navigation={navigation} screenProps={screenProps} />
        }
      />
      <Card style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={styles.avatarText}>
            {username.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={[styles.identityName, { color: colors.text }]}>
            {adjusterCard?.values.name || username}
          </Text>
          <Text style={[styles.cardBody, { color: colors.muted }]}>
            {adjusterCard?.values.professional_headline ||
              'Adjuster Network member'}
          </Text>
        </View>
      </Card>
      <SectionTitle title="Account" />
      {adjusterNetwork.features.pushEducation ? (
        <NotificationEducation
          status={screenProps.pushStatus}
          onEnable={screenProps.enablePush}
        />
      ) : null}
      <ProfileLink
        icon="user"
        label="View profile"
        onPress={() => screenProps.openUrl(`${site.url}/u/${username}`)}
      />
      <ProfileLink
        icon="gear"
        label="Account & preferences"
        onPress={() =>
          screenProps.openUrl(`${site.url}/u/${username}/preferences/account`)
        }
      />
      <ProfileLink
        icon="bookmark"
        label="Bookmarks"
        onPress={() => navigation.navigate('Bookmarks')}
      />
      <ProfileLink
        icon="search"
        label="Search the Network"
        onPress={() => navigation.navigate('Search')}
      />
      {site?.isStaff ? (
        <ProfileLink
          icon="shield"
          label="Operator workspace"
          detail="Separate from the member experience"
          onPress={() => screenProps.openUrl(`${site.url}/admin`)}
        />
      ) : null}
      <ProfileLink
        icon="sign-out-alt"
        label="Log out of this device"
        danger
        onPress={() => screenProps.siteManager.remove(site)}
      />
      <Text style={[styles.finePrint, { color: colors.muted }]}>
        Your Adjuster Card shows only fields enabled by the Network. Private
        résumé data is never displayed here or exposed to recruiter search.
      </Text>
    </Screen>
  );
}

const NotificationEducation = ({ status, onEnable }) => {
  const colors = useProductTheme();
  const denied = status === 'denied';
  const enabled = status === 'enabled';
  const working = status === 'working';
  const failed = typeof status === 'string' && status.includes('_');
  return (
    <Card style={styles.notificationEducation}>
      <View style={styles.notificationEducationHeader}>
        <FontAwesome5
          name="bell"
          size={18}
          color={colors.accent}
          iconStyle="solid"
        />
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Notifications
        </Text>
      </View>
      <Text style={[styles.cardBody, { color: colors.muted }]}>
        {enabled
          ? 'Important member activity is enabled for this device.'
          : working
          ? 'Finishing secure registration for this device…'
          : failed
          ? `Secure registration could not finish (${status}).`
          : denied
          ? 'Notifications are off. You can keep using every member feature.'
          : 'Choose whether this device may alert you to important member activity. No marketing.'}
      </Text>
      {!enabled && !working ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enable member notifications"
          onPress={onEnable}
          style={[styles.notificationEnable, { borderColor: colors.accent }]}
        >
          <Text style={[styles.profileLabel, { color: colors.accent }]}>
            Enable notifications
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
};

const ProfileLink = ({ icon, label, detail, onPress, danger }) => {
  const colors = useProductTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.profileLink, { borderColor: colors.border }]}
    >
      <FontAwesome5
        name={icon}
        size={17}
        color={danger ? colors.danger : colors.accent}
        iconStyle="solid"
      />
      <View style={styles.topicCopy}>
        <Text
          style={[
            styles.profileLabel,
            { color: danger ? colors.danger : colors.text },
          ]}
        >
          {label}
        </Text>
        {detail ? (
          <Text style={[styles.cardBody, { color: colors.muted }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <FontAwesome5
        name="chevron-right"
        size={13}
        color={colors.muted}
        iconStyle="solid"
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: { flex: 1 },
  scroll: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 120,
  },
  welcome: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
    gap: 10,
  },
  welcomeWide: { paddingVertical: 50 },
  brandLogoPlate: {
    width: 156,
    height: 112,
    borderRadius: 14,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 6,
    overflow: 'hidden',
  },
  // An explicit height prevents Fabric from falling back to the PNG's Retina
  // pixel dimensions while it resolves the intrinsic image size.
  brandLogo: { width: 144, height: 103, aspectRatio: 1183 / 845 },
  welcomeTitle: { fontSize: 30, lineHeight: 36, fontWeight: '850' },
  welcomeBody: { fontSize: 16, lineHeight: 23 },
  valueCard: {
    padding: 14,
    borderRadius: radius.lg,
    gap: 12,
    marginVertical: 2,
  },
  value: { flexDirection: 'row', gap: 13 },
  valueCopy: { flex: 1 },
  valueTitle: { fontSize: 16, fontWeight: '750' },
  valueBody: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  finePrint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
  hero: { borderRadius: radius.lg, padding: spacing.lg, marginTop: 8 },
  heroKicker: {
    color: '#82CEDC',
    fontSize: 12,
    fontWeight: '850',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    marginTop: 10,
  },
  heroBody: { color: '#C9D7E0', fontSize: 15, lineHeight: 22, marginTop: 8 },
  twoCol: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  flexCard: { flex: 1, minWidth: 260 },
  cardKicker: { fontSize: 11, fontWeight: '850', letterSpacing: 1 },
  cardTitle: { fontSize: 17, fontWeight: '750' },
  cardBody: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  topic: {
    minHeight: 76,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topicCopy: { flex: 1 },
  topicTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  topicMeta: { fontSize: 12, marginTop: 6 },
  pills: { gap: 8, paddingBottom: spacing.md },
  loungeAction: { alignItems: 'flex-start', marginBottom: spacing.md },
  permissionNote: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  composerSafe: { flex: 1 },
  loungeComposer: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  composerHeading: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  composerGuidance: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  composerTitleInput: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    marginBottom: spacing.sm,
  },
  composerBodyInput: {
    minHeight: 180,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 17,
    lineHeight: 24,
  },
  composerError: { fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  composerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  safety: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    borderWidth: 0,
  },
  safetyCopy: { flex: 1 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.lg,
  },
  category: {
    width: '48%',
    minWidth: 150,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
  },
  categoryTitle: { fontSize: 15, fontWeight: '750' },
  intro: { fontSize: 16, lineHeight: 24, marginBottom: spacing.md },
  intel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  intelIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  available: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  identityName: { fontSize: 20, fontWeight: '800' },
  profileLink: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  profileLabel: { fontSize: 16, fontWeight: '650' },
  notificationEducation: { marginBottom: spacing.md },
  notificationEducationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationEnable: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
});
