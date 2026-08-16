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
  Avatar,
  Card,
  Metadata,
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
import { radius, spacing, type } from './DesignSystem';
import { adjusterNetwork } from '../adjusterNetworkConfig';
export { default as LoungeScreen } from './NativeLoungeScreen';
import EmojiTextInput from './EmojiTextInput';
import { parseAdjusterCard } from '../adjusterCardClient';
import {
  canAttemptNotificationSetup,
  NOTIFICATION_STATUS,
} from '../notificationStatus';
import { openMemberAdjusterCard } from './memberNavigation';

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
  const { width, fontScale } = useWindowDimensions();
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
            fontScale >= 1.6 && styles.welcomeAccessibility,
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

const topicAvatar = (site, topic) => {
  const template = topic.posters?.[0]?.avatar_template;
  if (!template) return null;
  const path = template.replace('{size}', '80');
  return path.startsWith('http') ? path : `${site.url}${path}`;
};

const TopicCard = ({
  topic,
  site,
  openUrl,
  navigation,
  category,
  featured = false,
}) => {
  const colors = useProductTheme();
  const replies = Math.max(0, (topic.posts_count || 1) - 1);
  const lastActivity = topic.last_posted_at
    ? new Date(topic.last_posted_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : 'Recently';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open discussion: ${topic.title}`}
      onPress={() => openUrl(`${site.url}${topicPath(topic)}`)}
      style={({ pressed }) => [
        styles.topic,
        featured && styles.topicFeatured,
        {
          backgroundColor: featured ? colors.surfaceWarm : 'transparent',
          borderColor: featured ? colors.brandAccent : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${
          topic.last_poster_username || 'member'
        } Adjuster Card`}
        disabled={!topic.last_poster_username}
        onPress={event => {
          event.stopPropagation();
          openMemberAdjusterCard(navigation, topic.last_poster_username);
        }}
      >
        <Avatar
          label={topic.last_poster_username || 'Member'}
          size={38}
          uri={topicAvatar(site, topic)}
        />
      </Pressable>
      <View style={styles.topicCopy}>
        <View style={styles.topicContext}>
          {category ? (
            <Text style={[styles.topicCategory, { color: colors.accent }]}>
              {category.name}
            </Text>
          ) : null}
          {topic.unseen || topic.new_posts ? (
            <View
              style={[
                styles.unreadDot,
                { backgroundColor: colors.amber || '#D99A2B' },
              ]}
            />
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={[styles.topicTitle, { color: colors.text }]}
        >
          {topic.title}
        </Text>
        <View style={styles.topicMetadata}>
          <Metadata accent>Open conversation ·</Metadata>
          <Pressable
            accessibilityRole="link"
            disabled={!topic.last_poster_username}
            onPress={event => {
              event.stopPropagation();
              openMemberAdjusterCard(navigation, topic.last_poster_username);
            }}
          >
            <Metadata>
              {topic.last_poster_username || 'Network member'}
            </Metadata>
          </Pressable>
          <Metadata>·</Metadata>
          <Metadata>
            {replies === 1 ? '1 reply' : `${replies} replies`}
          </Metadata>
          <Metadata>·</Metadata>
          <Metadata>{topic.views || 0} views</Metadata>
          <Metadata>·</Metadata>
          <Metadata>{lastActivity}</Metadata>
        </View>
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
        <Text style={styles.heroKicker}>NETWORK BRIEFING</Text>
        <Text style={styles.heroTitle}>
          {data.topics[0]?.title || 'Your adjuster network, in one place.'}
        </Text>
        <Text style={styles.heroBody}>
          {data.topics[0]
            ? 'The most recent member conversation, followed by the activity and intelligence that matter now.'
            : 'Member conversations and source-backed intelligence will appear here as the Network publishes them.'}
        </Text>
      </View>
      <View style={styles.networkPulse}>
        <View style={styles.pulseItem}>
          <Text style={[styles.pulseValue, { color: colors.text }]}>
            {data.topics.length}
          </Text>
          <Text style={[styles.pulseLabel, { color: colors.muted }]}>
            ACTIVE DISCUSSIONS
          </Text>
        </View>
        <View
          style={[styles.pulseDivider, { backgroundColor: colors.border }]}
        />
        <View style={styles.pulseItem}>
          <Text style={[styles.pulseValue, { color: colors.text }]}>
            {data.categories.length}
          </Text>
          <Text style={[styles.pulseLabel, { color: colors.muted }]}>
            KNOWLEDGE AREAS
          </Text>
        </View>
      </View>
      <View style={[styles.deskStrip, { borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Intelligence')}
          style={styles.deskItem}
        >
          <Text style={[styles.cardKicker, { color: colors.accent }]}>
            CLAIMS WEATHER
          </Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Field conditions desk
          </Text>
          <Text style={[styles.cardBody, { color: colors.muted }]}>
            Current, source-backed weather context when published.
          </Text>
        </Pressable>
        <View
          style={[styles.deskDivider, { backgroundColor: colors.border }]}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Intelligence')}
          style={styles.deskItem}
        >
          <Text style={[styles.cardKicker, { color: colors.accent }]}>
            FIELD KNOWLEDGE
          </Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            The working playbook
          </Text>
          <Text style={[styles.cardBody, { color: colors.muted }]}>
            Reviewed methods from the claims field.
          </Text>
        </Pressable>
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
          .map((topic, index) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              site={site}
              openUrl={screenProps.openUrl}
              navigation={navigation}
              category={data.categories.find(
                category => category.id === topic.category_id,
              )}
              featured={index === 0}
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
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const data = useCommunity(
    screenProps.siteManager,
    screenProps.memberContentVersion,
  );
  const [filter, setFilter] = useState('all');
  const selectedCategory = data.categories.find(
    category => String(category.id) === filter,
  );
  const categories = [
    { key: 'all', name: 'All' },
    { key: 'unanswered', name: 'Unanswered' },
    ...data.categories.map(category => ({
      key: String(category.id),
      name: category.name,
    })),
  ];
  const visible = useMemo(
    () =>
      data.topics.filter(
        topic =>
          filter === 'all' ||
          (filter === 'unanswered'
            ? (topic.posts_count || 1) <= 1
            : String(topic.category_id) === filter),
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
            key={item.key}
            label={item.name}
            selected={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </ScrollView>
      <View style={styles.feedIntroduction}>
        <Text style={[styles.feedEyebrow, { color: colors.brandAccent }]}>
          MEMBER EXCHANGE
        </Text>
        <Text style={[styles.feedIntroductionCopy, { color: colors.muted }]}>
          Current questions, field perspective, and durable working knowledge.
        </Text>
      </View>
      {selectedCategory ? (
        <View style={styles.categoryDiscovery}>
          <Text style={[styles.categoryDescription, { color: colors.muted }]}>
            {selectedCategory.description_text ||
              `Browse every discussion in ${selectedCategory.name}.`}
          </Text>
          <Action
            label={`Open ${selectedCategory.name}`}
            secondary
            onPress={() =>
              screenProps.openUrl(
                `${site.url}/c/${selectedCategory.slug}/${selectedCategory.id}`,
              )
            }
          />
        </View>
      ) : null}
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
            navigation={navigation}
            category={data.categories.find(
              category => category.id === topic.category_id,
            )}
          />
        ))
      ) : (
        <StateCard
          icon="comments"
          title="Nothing here yet"
          body={
            filter === 'unanswered'
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
      <View
        style={[styles.intelligenceIntro, { backgroundColor: colors.hero }]}
      >
        <Text style={styles.intelligenceKicker}>THE NETWORK DESK</Text>
        <Text style={styles.intelligenceTitle}>
          Field intelligence, curated for adjusters.
        </Text>
        <Text style={styles.intelligenceBody}>
          Source-backed claims briefings, weather context, and practical field
          knowledge published for Network members.
        </Text>
      </View>
      {rows.map((row, index) => (
        <Pressable
          key={row.title}
          accessibilityRole="link"
          onPress={() => screenProps.openUrl(`${site.url}${row.path}`)}
          style={({ pressed }) => [
            styles.intel,
            {
              backgroundColor: colors.canvas,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.deskNumber, { color: colors.brandAccent }]}>
            {String(index + 1).padStart(2, '0')}
          </Text>
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
              View published content
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
  const [avatarTemplate, setAvatarTemplate] = useState(null);
  useEffect(() => {
    let mounted = true;
    if (site?.authToken) {
      Promise.all([
        site.jsonApi('/native/v1/profile'),
        site
          .jsonApi(`/u/${encodeURIComponent(username)}.json`)
          .catch(() => null),
      ])
        .then(([profilePayload, userPayload]) => {
          if (mounted) {
            setAdjusterCard(parseAdjusterCard(profilePayload));
            setAvatarTemplate(
              profilePayload?.core?.avatar_template ||
                userPayload?.user?.avatar_template ||
                null,
            );
          }
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
      <View
        style={[
          styles.identity,
          { borderColor: colors.border, borderLeftColor: colors.brandAccent },
        ]}
      >
        {avatarTemplate ? (
          <Image
            accessibilityLabel={`${username} profile photo`}
            source={{
              uri: avatarTemplate.startsWith('http')
                ? avatarTemplate.replace('{size}', '120')
                : `${site.url}${avatarTemplate.replace('{size}', '120')}`,
            }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>
              {username.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.identityCopy}>
          <Text style={[styles.identityEyebrow, { color: colors.brandAccent }]}>
            PROFESSIONAL IDENTITY
          </Text>
          <Text style={[styles.identityName, { color: colors.text }]}>
            {adjusterCard?.values.name || username}
          </Text>
          <Text style={[styles.cardBody, { color: colors.muted }]}>
            {adjusterCard?.values.professional_headline ||
              'Adjuster Network member'}
          </Text>
          {adjusterCard?.values.bio ? (
            <Text
              numberOfLines={2}
              style={[styles.identityBio, { color: colors.muted }]}
            >
              {adjusterCard.values.bio}
            </Text>
          ) : null}
          <View style={styles.identityTags}>
            {(Array.isArray(adjusterCard?.values.licensed_states)
              ? adjusterCard.values.licensed_states
              : []
            )
              .slice(0, 3)
              .map(state => (
                <View
                  key={state}
                  style={[
                    styles.identityTag,
                    { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <Text
                    style={[styles.identityTagText, { color: colors.accent }]}
                  >
                    {state}
                  </Text>
                </View>
              ))}
          </View>
          {adjusterCard?.values.base_state ? (
            <Text style={[styles.identityDetail, { color: colors.muted }]}>
              Based in {adjusterCard.values.base_state}
            </Text>
          ) : null}
          {[
            ['Adjuster type', adjusterCard?.values.adjuster_type],
            ['Experience', adjusterCard?.values.years_experience],
            ['CAT experience', adjusterCard?.values.cat_experience],
            ['Work mode', adjusterCard?.values.work_mode],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <Text
                key={label}
                style={[styles.identityDetail, { color: colors.muted }]}
              >
                {label}: {String(value).replaceAll('_', ' ')}
              </Text>
            ))}
          {Array.isArray(adjusterCard?.values.specialties) &&
          adjusterCard.values.specialties.length ? (
            <Text style={[styles.identityDetail, { color: colors.muted }]}>
              Specialties: {adjusterCard.values.specialties.join(', ')}
            </Text>
          ) : null}
        </View>
      </View>
      <SectionTitle
        title="Member tools"
        detail="Your activity, saved knowledge, and account controls."
      />
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
        icon="cog"
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
      {adjusterCard?.resume?.enabled ? (
        <Text style={[styles.finePrint, { color: colors.muted }]}>
          Private résumé data is never displayed to Network members or exposed
          to recruiter search.
        </Text>
      ) : null}
    </Screen>
  );
}

const NotificationEducation = ({ status, onEnable }) => {
  const colors = useProductTheme();
  const denied = status === 'denied';
  const enabled = status === 'enabled';
  const working = status === 'working';
  const failed = typeof status === 'string' && status.includes('_');
  const temporarilyUnavailable = status === 'push_temporarily_unavailable';
  const developmentBuild =
    status === NOTIFICATION_STATUS.DEVELOPMENT_BUILD_LIMITATION;
  return (
    <View
      style={[styles.notificationEducation, { borderColor: colors.border }]}
    >
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
          : developmentBuild
          ? 'Notifications are unavailable in this development build.'
          : temporarilyUnavailable
          ? 'Notification setup is taking a short break. You can keep using the Network and try again in a minute.'
          : failed
          ? 'Notifications could not be enabled right now. You can keep using every member feature and try again later.'
          : denied
          ? 'Notifications are off. You can keep using every member feature.'
          : 'Choose whether this device may alert you to important member activity. No marketing.'}
      </Text>
      {canAttemptNotificationSetup(status) ? (
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
    </View>
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
  welcomeAccessibility: {
    justifyContent: 'flex-start',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
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
  hero: {
    borderRadius: radius.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#B3262D',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
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
  networkPulse: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  pulseItem: {
    flex: 1,
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
  },
  pulseDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  pulseValue: type.numeric,
  pulseLabel: { ...type.label, fontSize: 10, marginTop: 2 },
  twoCol: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  deskStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
  },
  deskItem: {
    flex: 1,
    minWidth: 250,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  deskDivider: { width: StyleSheet.hairlineWidth, marginVertical: spacing.sm },
  flexCard: { flex: 1, minWidth: 260 },
  cardKicker: { fontSize: 11, fontWeight: '850', letterSpacing: 1 },
  cardTitle: { fontSize: 17, fontWeight: '750' },
  cardBody: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  topic: {
    minHeight: 82,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 13,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  topicFeatured: {
    borderLeftWidth: 3,
    borderBottomWidth: 0,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  topicCopy: { flex: 1 },
  topicContext: { flexDirection: 'row', alignItems: 'center', minHeight: 17 },
  topicCategory: { ...type.label, fontSize: 10 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, marginLeft: spacing.xs },
  topicTitle: { ...type.topic, marginTop: 2 },
  topicMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 5,
  },
  pills: { gap: 7, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  feedIntroduction: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(120, 128, 130, 0.28)',
  },
  feedEyebrow: type.label,
  feedIntroductionCopy: { ...type.body, marginTop: 2 },
  categoryDiscovery: { alignItems: 'flex-start', marginBottom: spacing.md },
  categoryDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
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
    borderLeftWidth: 3,
    borderLeftColor: '#176B87',
    borderRadius: radius.sm,
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
  intelligenceIntro: {
    borderRadius: radius.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#B3262D',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  intelligenceKicker: { ...type.label, color: '#82CEDC' },
  intelligenceTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '820',
    marginTop: spacing.sm,
  },
  intelligenceBody: { color: '#C9D7E0', ...type.body, marginTop: spacing.xs },
  intel: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deskNumber: { ...type.label, width: 24 },
  intelIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  available: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  identityCopy: { flex: 1 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  identityName: { fontSize: 24, lineHeight: 30, fontWeight: '820' },
  identityEyebrow: { ...type.label, marginBottom: spacing.xs },
  identityBio: { ...type.body, marginTop: spacing.xs },
  identityDetail: { ...type.meta, marginTop: spacing.xs },
  identityTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  identityTag: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  identityTagText: { fontSize: 11, lineHeight: 15, fontWeight: '750' },
  profileLink: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  profileLabel: { fontSize: 16, fontWeight: '650' },
  notificationEducation: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  notificationEducationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationEnable: {
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
});
