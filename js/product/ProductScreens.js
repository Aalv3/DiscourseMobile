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
  NotificationBell,
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
import { elevation, floorV2, radius, spacing, type } from './DesignSystem';
import { adjusterNetwork } from '../adjusterNetworkConfig';
export { default as LoungeScreen } from './NativeLoungeScreen';
import EmojiTextInput from './EmojiTextInput';
import { parseAdjusterCard } from '../adjusterCardClient';
import { openMemberAdjusterCard } from './memberNavigation';
import { optionLabel, stateLabel } from './adjusterCardPresentation';
import AttachmentComposer, { useAttachmentQueue } from './AttachmentComposer';
import { reconcileAskSubmission, submitAskQuestion } from './AskSubmission';
import NotificationEducation from './NotificationEducation';

const Screen = ({ children, backgroundColor }) => {
  const colors = useProductTheme();
  const canvas = backgroundColor || colors.canvas;
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: canvas }]}
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

const FloorHeader = ({ navigation, screenProps }) => {
  const colors = useProductTheme();
  return (
    <View style={[styles.floorHeader, { borderBottomColor: colors.border }]}>
      <Image
        accessibilityLabel="Adjuster Network"
        accessibilityRole="image"
        resizeMode="contain"
        source={require('../../img/adjuster-network-logo.png')}
        style={styles.floorLogo}
      />
      <HeaderActions navigation={navigation} screenProps={screenProps} search />
    </View>
  );
};

export function WelcomeScreen({ onConnect, busy }) {
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
          testID="logged-out-welcome-scroll"
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
          <View
            style={[
              styles.welcomeRule,
              { backgroundColor: colors.brandAccent },
            ]}
          />
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
              title="Invitation-only membership"
              body="Approved members connect across the claims community."
            />
            <Value
              icon="clipboard-check"
              title="Useful by design"
              body="Claims intelligence, practical knowledge, and focused discussions."
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Signing in' : 'Member sign in'}
            disabled={busy}
            onPress={onConnect}
            style={[
              styles.welcomePrimary,
              { backgroundColor: colors.hero, opacity: busy ? 0.55 : 1 },
            ]}
          >
            <FontAwesome5
              name="arrow-right"
              size={18}
              color="#FFFFFF"
              iconStyle="solid"
            />
            <Text style={styles.welcomePrimaryText}>
              {busy ? 'Signing in…' : 'Member sign in'}
            </Text>
          </Pressable>
          <Text style={[styles.finePrint, { color: colors.muted }]}>
            Membership is currently available by invitation. Existing members
            can sign in above.
          </Text>
          <View style={styles.welcomePrivacy}>
            <FontAwesome5
              name="shield-alt"
              size={18}
              color={colors.brandAccent}
              iconStyle="solid"
            />
            <Text style={[styles.finePrint, { color: colors.muted }]}>
              Never post names, policy numbers, addresses, photos, or other
              claim-identifying information.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Value = ({ icon, title, body }) => {
  const colors = useProductTheme();
  return (
    <View style={styles.value}>
      <View style={[styles.valueIcon, { backgroundColor: colors.surfaceWarm }]}>
        <FontAwesome5
          name={icon}
          size={18}
          color={colors.hero}
          iconStyle="solid"
        />
      </View>
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

const memberDisplayName = username =>
  String(username || 'member')
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part =>
      part.length <= 2
        ? part.toUpperCase()
        : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ');

const topicActivityDate = topic =>
  topic.last_posted_at
    ? new Date(topic.last_posted_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : 'Recent';

const FloorActivityRow = ({ topic, site, navigation, openUrl, category }) => {
  const colors = useProductTheme();
  const username = topic.last_poster_username || 'Network member';
  const replies = Math.max(0, (topic.posts_count || 1) - 1);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open discussion: ${topic.title}`}
      onPress={() => openUrl(`${site.url}${topicPath(topic)}`)}
      style={({ pressed }) => [
        styles.floorActivityRow,
        { borderBottomColor: colors.border },
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${username} Adjuster Card`}
        disabled={!topic.last_poster_username}
        onPress={event => {
          event.stopPropagation();
          openMemberAdjusterCard(navigation, topic.last_poster_username);
        }}
      >
        <Avatar label={username} size={44} uri={topicAvatar(site, topic)} />
      </Pressable>
      <View style={styles.topicCopy}>
        <View style={styles.floorActivityContext}>
          <Text
            maxFontSizeMultiplier={1.5}
            numberOfLines={1}
            style={[styles.floorActivityCategory, { color: colors.accent }]}
          >
            {category?.name || 'Discussion'}
          </Text>
          <Text style={[styles.floorActivityDate, { color: colors.muted }]}>
            {topicActivityDate(topic)}
          </Text>
        </View>
        <Text
          maxFontSizeMultiplier={1.5}
          numberOfLines={2}
          style={[styles.floorActivityTitle, { color: colors.text }]}
        >
          {topic.title}
        </Text>
        <Text
          maxFontSizeMultiplier={1.6}
          numberOfLines={1}
          style={[styles.floorActivityMeta, { color: colors.muted }]}
        >
          {memberDisplayName(username)} ·{' '}
          {replies === 1 ? '1 reply' : `${replies} replies`}
        </Text>
      </View>
      <View style={[styles.floorActivityArrow, { borderColor: colors.border }]}>
        <FontAwesome5
          name="chevron-right"
          size={11}
          color={colors.muted}
          iconStyle="solid"
        />
      </View>
    </Pressable>
  );
};

const FloorAttentionCard = ({ topic, site, category, openUrl, cardWidth }) => {
  const colors = useProductTheme();
  const replies = Math.max(0, (topic.posts_count || 1) - 1);
  const username = topic.last_poster_username || 'Network member';
  const categoryColor = /^#?[0-9a-f]{6}$/i.test(category?.color || '')
    ? `#${String(category.color).replace('#', '')}`
    : colors.accent;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${topic.title}. ${category?.name || 'Discussion'}. ${
        replies === 0 ? 'Needs a reply' : `${replies} replies`
      }.`}
      onPress={() => openUrl(`${site.url}${topicPath(topic)}`)}
      style={({ pressed }) => [
        styles.floorAttentionCard,
        {
          width: cardWidth,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        pressed && styles.floorPressed,
      ]}
    >
      <View
        style={[
          styles.floorAttentionAccent,
          { backgroundColor: categoryColor },
        ]}
      />
      <View style={styles.floorAttentionTopline}>
        <Text
          maxFontSizeMultiplier={1.4}
          numberOfLines={1}
          style={[styles.floorAttentionCategory, { color: categoryColor }]}
        >
          {category?.name || 'Discussion'}
        </Text>
        <View
          style={[
            styles.floorAttentionState,
            {
              backgroundColor:
                replies === 0 ? colors.brandAccentSoft : colors.accentSoft,
            },
          ]}
        >
          <FontAwesome5
            name={replies === 0 ? 'question' : 'comments'}
            size={9}
            color={replies === 0 ? colors.brandAccent : colors.accent}
            iconStyle="solid"
          />
          <Text
            style={[
              styles.floorAttentionStateText,
              { color: replies === 0 ? colors.brandAccent : colors.accent },
            ]}
          >
            {replies === 0 ? 'NEEDS A REPLY' : 'ACTIVE'}
          </Text>
        </View>
      </View>
      <Text
        maxFontSizeMultiplier={1.5}
        numberOfLines={2}
        style={[styles.floorAttentionTitle, { color: colors.text }]}
      >
        {topic.title}
      </Text>
      <View style={styles.floorAttentionFooter}>
        <Avatar label={username} size={32} uri={topicAvatar(site, topic)} />
        <View style={styles.floorAttentionIdentity}>
          <Text
            maxFontSizeMultiplier={1.4}
            numberOfLines={1}
            style={[styles.floorAttentionAuthor, { color: colors.text }]}
          >
            {memberDisplayName(username)}
          </Text>
          <Text
            maxFontSizeMultiplier={1.4}
            numberOfLines={1}
            style={[styles.floorAttentionMeta, { color: colors.muted }]}
          >
            {topicActivityDate(topic)} ·{' '}
            {replies === 1 ? '1 reply' : `${replies} replies`}
          </Text>
        </View>
        <FontAwesome5
          name="arrow-right"
          size={12}
          color={colors.muted}
          iconStyle="solid"
        />
      </View>
    </Pressable>
  );
};

export function FloorScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const { fontScale, width } = useWindowDimensions();
  const site = activeMemberSite(screenProps.siteManager);
  const data = useCommunity(
    screenProps.siteManager,
    screenProps.memberContentVersion,
  );
  const memberName = memberDisplayName(site?.username);
  const greeting = new Date().getHours() < 12 ? 'Good morning' : 'Welcome back';
  const attentionTopics = data.topics.slice(0, 5);
  const attentionCardWidth = Math.min(Math.max(width - 64, 280), 340);
  const unanswered = data.topics.filter(
    topic => (topic.posts_count || 1) <= 1,
  ).length;
  return (
    <Screen backgroundColor={colors.isDark ? colors.canvas : floorV2.canvas}>
      <FloorHeader navigation={navigation} screenProps={screenProps} />
      <View style={styles.floorGreeting}>
        <Text
          maxFontSizeMultiplier={1.5}
          style={[styles.floorGreetingTitle, { color: colors.text }]}
        >
          {greeting}, {memberName}
        </Text>
        <Text
          maxFontSizeMultiplier={1.6}
          style={[styles.floorGreetingBody, { color: colors.muted }]}
        >
          Here’s what’s moving across your network.
        </Text>
      </View>

      <View style={styles.floorAttentionHeading}>
        <View>
          <Text
            maxFontSizeMultiplier={1.5}
            style={[styles.floorAttentionHeadingTitle, { color: colors.text }]}
          >
            Worth your attention
          </Text>
          <Text
            maxFontSizeMultiplier={1.5}
            style={[styles.floorAttentionHint, { color: colors.muted }]}
          >
            Swipe for more from the Network
          </Text>
        </View>
        <FontAwesome5
          accessibilityElementsHidden
          name="arrows-alt-h"
          size={13}
          color={colors.muted}
          iconStyle="solid"
        />
      </View>
      {attentionTopics.length ? (
        <ScrollView
          accessibilityLabel="Worth your attention topics"
          horizontal
          decelerationRate="fast"
          disableIntervalMomentum
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={attentionCardWidth + spacing.sm}
          contentContainerStyle={styles.floorAttentionRail}
          style={styles.floorAttentionScroller}
        >
          {attentionTopics.map(topic => (
            <FloorAttentionCard
              key={topic.id}
              topic={topic}
              site={site}
              category={data.categories.find(
                category => category.id === topic.category_id,
              )}
              openUrl={screenProps.openUrl}
              cardWidth={attentionCardWidth}
            />
          ))}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.floorAttentionEmpty,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.floorAttentionEmptyText, { color: colors.muted }]}
          >
            New discussions will appear here when members post them.
          </Text>
        </View>
      )}

      <View
        style={[
          styles.floorActionsHeading,
          fontScale >= 1.6 && styles.floorActionsHeadingAccessible,
        ]}
      >
        <Text style={[styles.floorActionsTitle, { color: colors.text }]}>
          Network at a glance
        </Text>
        <Pressable onPress={() => navigation.navigate('Intelligence')}>
          <Text style={[styles.floorSeeAll, { color: colors.accent }]}>
            Intel desk
          </Text>
        </Pressable>
      </View>
      <View
        style={[
          styles.floorStats,
          fontScale >= 1.6 && styles.floorStatsAccessible,
        ]}
      >
        <FloorStat
          colors={colors}
          icon="comments"
          label="Discussions"
          detail="Latest topics"
          value={data.topics.length}
          onPress={() => navigation.navigate('Discussions')}
          accessibleLayout={fontScale >= 1.6}
        />
        <FloorStat
          colors={colors}
          icon="question"
          label="Unanswered"
          detail="Need a reply"
          value={unanswered}
          onPress={() => navigation.navigate('Discussions')}
          tone="red"
          accessibleLayout={fontScale >= 1.6}
        />
        <FloorStat
          colors={colors}
          icon="layer-group"
          label="Knowledge"
          detail="Browse categories"
          value={data.categories.length}
          onPress={() => navigation.navigate('Discussions')}
          tone="teal"
          accessibleLayout={fontScale >= 1.6}
        />
        <FloorStat
          colors={colors}
          icon="signal"
          label="Intelligence"
          detail="Open the desk"
          value="Open"
          onPress={() => navigation.navigate('Intelligence')}
          tone="navy"
          accessibleLayout={fontScale >= 1.6}
        />
      </View>

      <View
        style={[
          styles.floorSectionHeading,
          fontScale >= 1.6 && styles.floorSectionHeadingAccessible,
        ]}
      >
        <View>
          <Text
            maxFontSizeMultiplier={1.5}
            style={[styles.floorSectionTitle, { color: colors.text }]}
          >
            Network activity
          </Text>
          <Text
            maxFontSizeMultiplier={1.6}
            style={[styles.floorSectionDetail, { color: colors.muted }]}
          >
            Recent conversations from members
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => navigation.navigate('Discussions')}
        >
          <Text
            maxFontSizeMultiplier={1.5}
            style={[styles.floorSeeAll, { color: colors.accent }]}
          >
            See all
          </Text>
        </Pressable>
      </View>
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
        <View
          style={[
            styles.floorActivityFeed,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {data.topics.slice(0, 4).map(topic => (
            <FloorActivityRow
              key={topic.id}
              topic={topic}
              site={site}
              openUrl={screenProps.openUrl}
              navigation={navigation}
              category={data.categories.find(
                category => category.id === topic.category_id,
              )}
            />
          ))}
        </View>
      ) : (
        <StateCard
          title="The Floor is quiet"
          body="There are no recent discussions to show yet. Start with a useful question when you’re ready."
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Review your Adjuster Card"
        onPress={() => navigation.navigate('Profile')}
        style={({ pressed }) => [
          styles.floorProfileCta,
          { backgroundColor: colors.accentSoft },
          pressed && styles.floorPressed,
        ]}
      >
        <View
          style={[styles.floorProfileIcon, { backgroundColor: colors.surface }]}
        >
          <FontAwesome5
            name="id-card"
            size={17}
            color={colors.accent}
            iconStyle="solid"
          />
        </View>
        <View style={styles.topicCopy}>
          <Text
            maxFontSizeMultiplier={1.5}
            style={[styles.floorProfileTitle, { color: colors.text }]}
          >
            Your Adjuster Card
          </Text>
          <Text
            maxFontSizeMultiplier={1.6}
            style={[styles.floorProfileBody, { color: colors.muted }]}
          >
            Keep your professional profile current.
          </Text>
        </View>
        <FontAwesome5
          name="arrow-right"
          size={14}
          color={colors.accent}
          iconStyle="solid"
        />
      </Pressable>
    </Screen>
  );
}

const FloorStat = ({
  colors,
  icon,
  label,
  detail,
  value,
  onPress,
  tone = 'blue',
  accessibleLayout = false,
}) => {
  const toneColor =
    tone === 'red'
      ? colors.brandAccent
      : tone === 'teal'
      ? colors.success
      : tone === 'navy'
      ? colors.hero
      : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.floorStat,
        accessibleLayout && styles.floorStatAccessible,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.floorPressed,
      ]}
    >
      <View style={[styles.floorStatIcon, { backgroundColor: toneColor }]}>
        <FontAwesome5 name={icon} size={15} color="#FFFFFF" iconStyle="solid" />
      </View>
      <Text
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.5}
        minimumFontScale={0.8}
        numberOfLines={1}
        style={[styles.floorStatValue, { color: toneColor }]}
      >
        {value}
      </Text>
      <Text
        maxFontSizeMultiplier={1.5}
        numberOfLines={2}
        style={[styles.floorStatLabel, { color: colors.muted }]}
      >
        {label}
      </Text>
      <Text
        maxFontSizeMultiplier={1.4}
        numberOfLines={2}
        style={[styles.floorStatDetail, { color: colors.muted }]}
      >
        {detail}
      </Text>
      <FontAwesome5
        name="arrow-right"
        size={11}
        color={colors.muted}
        iconStyle="solid"
        style={styles.floorStatArrow}
      />
    </Pressable>
  );
};

const discussionCategoryVisual = (category, index) => {
  const visuals = [
    { tint: '#DFF2F6', color: '#176B87' },
    { tint: '#E6F5EA', color: '#23804B' },
    { tint: '#FBE9E4', color: '#B3262D' },
    { tint: '#EEEAF8', color: '#4A3B91' },
    { tint: '#FFF2D8', color: '#9A6712' },
  ];
  const name = String(category?.name || '').toLowerCase();
  const icon = name.includes('lounge')
    ? 'couch'
    : name.includes('field')
    ? 'hard-hat'
    : name.includes('start')
    ? 'compass'
    : name.includes('announce')
    ? 'bullhorn'
    : name.includes('estimate') || name.includes('scope')
    ? 'calculator'
    : name.includes('career')
    ? 'briefcase'
    : name.includes('license') || name.includes('compliance')
    ? 'balance-scale'
    : 'comments';
  return { ...visuals[index % visuals.length], icon };
};

const DiscussionCategoryRow = ({ category, index, topicCount, onPress }) => {
  const colors = useProductTheme();
  const visual = discussionCategoryVisual(category, index);
  const description = String(category.description_text || '').trim();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${category.name}, ${topicCount} discussions`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.discussionCategoryRow,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        pressed && styles.floorPressed,
      ]}
    >
      <View
        style={[
          styles.discussionCategoryIcon,
          { backgroundColor: colors.isDark ? colors.surfaceAlt : visual.tint },
        ]}
      >
        <FontAwesome5
          name={visual.icon}
          size={20}
          color={colors.isDark ? colors.accent : visual.color}
          iconStyle="solid"
        />
      </View>
      <View style={styles.topicCopy}>
        <Text
          maxFontSizeMultiplier={1.5}
          numberOfLines={1}
          style={[styles.discussionCategoryName, { color: colors.text }]}
        >
          {category.name}
        </Text>
        <Text
          maxFontSizeMultiplier={1.5}
          numberOfLines={1}
          style={[
            styles.discussionCategoryDescription,
            { color: colors.muted },
          ]}
        >
          {description ||
            `Member knowledge and conversation in ${category.name}.`}
        </Text>
      </View>
      <View style={styles.discussionCategoryCount}>
        <Text
          style={[styles.discussionCategoryCountValue, { color: colors.text }]}
        >
          {topicCount}
        </Text>
        <Text
          style={[styles.discussionCategoryCountLabel, { color: colors.muted }]}
        >
          topics
        </Text>
      </View>
      <FontAwesome5
        name="chevron-right"
        size={12}
        color={colors.muted}
        iconStyle="solid"
      />
    </Pressable>
  );
};

const DiscussionFeedRow = ({ topic, category, site, navigation, openUrl }) => {
  const colors = useProductTheme();
  const username = topic.last_poster_username || 'Network member';
  const replies = Math.max(0, (topic.posts_count || 1) - 1);
  const unread = Boolean(topic.unseen || topic.new_posts);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open discussion: ${topic.title}`}
      onPress={() => openUrl(`${site.url}${topicPath(topic)}`)}
      style={({ pressed }) => [
        styles.discussionFeedRow,
        { borderBottomColor: colors.border },
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      <View style={styles.discussionUnreadSlot}>
        {unread ? (
          <View
            style={[
              styles.discussionUnreadDot,
              { backgroundColor: colors.brandAccent },
            ]}
          />
        ) : null}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${username} Adjuster Card`}
        disabled={!topic.last_poster_username}
        onPress={event => {
          event.stopPropagation();
          openMemberAdjusterCard(navigation, topic.last_poster_username);
        }}
      >
        <Avatar label={username} size={42} uri={topicAvatar(site, topic)} />
      </Pressable>
      <View style={styles.topicCopy}>
        <Text
          maxFontSizeMultiplier={1.5}
          numberOfLines={2}
          style={[styles.discussionFeedTitle, { color: colors.text }]}
        >
          {topic.title}
        </Text>
        <View style={styles.discussionFeedMeta}>
          <Text
            maxFontSizeMultiplier={1.4}
            numberOfLines={1}
            style={[styles.discussionFeedAuthor, { color: colors.muted }]}
          >
            {memberDisplayName(username)}
          </Text>
          <Text
            style={[styles.discussionFeedMetaText, { color: colors.muted }]}
          >
            ·
          </Text>
          <Text
            style={[styles.discussionFeedMetaText, { color: colors.muted }]}
          >
            {replies === 1 ? '1 reply' : `${replies} replies`}
          </Text>
          <Text
            style={[styles.discussionFeedMetaText, { color: colors.muted }]}
          >
            ·
          </Text>
          <Text
            style={[styles.discussionFeedMetaText, { color: colors.muted }]}
          >
            {topicActivityDate(topic)}
          </Text>
        </View>
        {category ? (
          <Text
            maxFontSizeMultiplier={1.4}
            numberOfLines={1}
            style={[styles.discussionFeedCategory, { color: colors.accent }]}
          >
            {category.name}
          </Text>
        ) : null}
      </View>
      {replies > 0 ? (
        <View
          style={[
            styles.discussionReplyBadge,
            { backgroundColor: colors.brandAccent },
          ]}
        >
          <Text style={styles.discussionReplyBadgeText}>{replies}</Text>
        </View>
      ) : null}
      <FontAwesome5
        name="chevron-right"
        size={12}
        color={colors.muted}
        iconStyle="solid"
      />
    </Pressable>
  );
};

export function DiscussionsScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const data = useCommunity(
    screenProps.siteManager,
    screenProps.memberContentVersion,
  );
  const [filter, setFilter] = useState('all');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const visible = useMemo(
    () =>
      data.topics.filter(
        topic => filter === 'all' || (topic.posts_count || 1) <= 1,
      ),
    [data, filter],
  );
  const categoryTopicCount = category =>
    category.topic_count ??
    data.topics.filter(topic => topic.category_id === category.id).length;
  const rankedCategories = [...data.categories].sort(
    (left, right) => categoryTopicCount(right) - categoryTopicCount(left),
  );
  const visibleCategories = rankedCategories.filter(
    (_, index) => showAllCategories || index < 5,
  );
  return (
    <Screen backgroundColor={colors.isDark ? colors.canvas : floorV2.canvas}>
      <FloorHeader navigation={navigation} screenProps={screenProps} />
      <View style={styles.discussionsTitleBlock}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.5}
          style={[styles.discussionsTitle, { color: colors.text }]}
        >
          Discussions
        </Text>
        <Text
          maxFontSizeMultiplier={1.6}
          style={[styles.discussionsSubtitle, { color: colors.muted }]}
        >
          Connect, ask questions, and share durable knowledge.
        </Text>
      </View>
      <View
        style={[
          styles.discussionsSegments,
          { borderBottomColor: colors.border },
        ]}
      >
        {[
          ['all', 'Categories'],
          ['unanswered', 'Unanswered'],
        ].map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === key }}
            onPress={() => setFilter(key)}
            style={styles.discussionsSegment}
          >
            <Text
              style={[
                styles.discussionsSegmentLabel,
                { color: filter === key ? colors.brandAccent : colors.muted },
              ]}
            >
              {label}
            </Text>
            {filter === key ? (
              <View
                style={[
                  styles.discussionsSegmentIndicator,
                  { backgroundColor: colors.brandAccent },
                ]}
              />
            ) : null}
          </Pressable>
        ))}
      </View>
      {filter === 'all' &&
      !data.loading &&
      !data.error &&
      data.categories.length ? (
        <>
          <View style={styles.discussionsSectionHeading}>
            <Text
              style={[styles.discussionsSectionTitle, { color: colors.text }]}
            >
              Top categories
            </Text>
            {data.categories.length > 5 ? (
              <Pressable onPress={() => setShowAllCategories(value => !value)}>
                <Text style={[styles.floorSeeAll, { color: colors.accent }]}>
                  {showAllCategories ? 'Show less' : 'View all'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.discussionCategoryList}>
            {visibleCategories.map((category, index) => (
              <DiscussionCategoryRow
                key={category.id}
                category={category}
                index={index}
                topicCount={categoryTopicCount(category)}
                onPress={() =>
                  screenProps.openUrl(
                    `${site.url}/c/${category.slug}/${category.id}`,
                  )
                }
              />
            ))}
          </View>
          <View style={styles.discussionsSectionHeading}>
            <Text
              style={[styles.discussionsSectionTitle, { color: colors.text }]}
            >
              Latest discussions
            </Text>
          </View>
        </>
      ) : filter === 'unanswered' ? (
        <View style={styles.discussionsSectionHeading}>
          <View>
            <Text
              style={[styles.discussionsSectionTitle, { color: colors.text }]}
            >
              Unanswered discussions
            </Text>
            <Text
              style={[styles.discussionsSectionDetail, { color: colors.muted }]}
            >
              Questions that could use member experience.
            </Text>
          </View>
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
        <View
          style={[
            styles.discussionFeed,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
            },
          ]}
        >
          {visible.map(topic => (
            <DiscussionFeedRow
              key={topic.id}
              topic={topic}
              site={site}
              openUrl={screenProps.openUrl}
              navigation={navigation}
              category={data.categories.find(
                category => category.id === topic.category_id,
              )}
            />
          ))}
        </View>
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
  const attachmentQueue = useAttachmentQueue(site, 'composer');
  const submissionInFlight = React.useRef(false);
  const data = useCommunity(
    screenProps.siteManager,
    screenProps.memberContentVersion,
  );
  const permittedCategories = askableCategories(data.categories);
  const [category, setCategory] = useState(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [question, setQuestion] = useState({
    title: '',
    raw: '',
    submitting: false,
    error: null,
    uncertainSince: null,
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
    if (
      !site?.authToken ||
      !category ||
      submissionInFlight.current ||
      question.uncertainSince
    )
      return;
    submissionInFlight.current = true;
    setQuestion(current => ({ ...current, submitting: true, error: null }));
    try {
      const { created } = await submitAskQuestion({
        site,
        uploadAll: attachmentQueue.uploadAll,
        title: question.title.trim(),
        raw: question.raw,
        categoryId: category.id,
      });
      setQuestion({
        title: '',
        raw: '',
        submitting: false,
        error: null,
        uncertainSince: null,
      });
      attachmentQueue.clear();
      screenProps.invalidateMemberContent();
      if (created?.topic_id) {
        screenProps.openUrl(
          `${site.url}/t/${created.topic_slug || 'topic'}/${created.topic_id}`,
        );
      }
    } catch (error) {
      setQuestion(current => ({
        ...current,
        submitting: false,
        uncertainSince:
          error?.askSubmissionStage === 'topic_submission_unconfirmed'
            ? error.startedAt
            : null,
        error:
          error?.askSubmissionStage === 'topic_submission_unconfirmed'
            ? 'We could not confirm whether this discussion was posted. Reconnect and check its status before submitting again.'
            : error?.askSubmissionStage === 'attachment_upload'
            ? 'The attachment did not upload. Retry it before posting.'
            : error?.userMessages?.join(' ') ||
              (error?.status === 403
                ? 'Your account is not permitted to ask in this category.'
                : 'Your question could not be posted. Please try again.'),
      }));
    } finally {
      submissionInFlight.current = false;
    }
  };
  const checkQuestionStatus = async () => {
    if (!question.uncertainSince || submissionInFlight.current) return;
    submissionInFlight.current = true;
    setQuestion(current => ({ ...current, submitting: true, error: null }));
    try {
      const topic = await reconcileAskSubmission(
        site,
        question.title,
        question.uncertainSince,
      );
      if (topic) {
        setQuestion({
          title: '',
          raw: '',
          submitting: false,
          error: null,
          uncertainSince: null,
        });
        attachmentQueue.clear();
        screenProps.invalidateMemberContent();
        screenProps.openUrl(
          `${site.url}/t/${topic.slug || 'topic'}/${topic.id}`,
        );
      } else {
        setQuestion(current => ({
          ...current,
          submitting: false,
          uncertainSince: null,
          error: 'No matching discussion was posted. You can submit it now.',
        }));
      }
    } catch {
      setQuestion(current => ({
        ...current,
        submitting: false,
        error: 'Status could not be checked. Reconnect and try again.',
      }));
    } finally {
      submissionInFlight.current = false;
    }
  };
  return (
    <Screen>
      <FloorHeader navigation={navigation} screenProps={screenProps} />
      <View style={styles.v2PageIntro}>
        <Text style={[styles.v2PageTitle, { color: colors.text }]}>
          Ask the Network
        </Text>
        <Text style={[styles.v2PageSubtitle, { color: colors.muted }]}>
          Get practical guidance from property-adjusting professionals.
        </Text>
      </View>
      {permittedCategories.length ? (
        <View
          style={[
            styles.askComposerCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.askFieldLabel, { color: colors.muted }]}>
            Choose a category
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Category, ${category?.name || 'not selected'}`}
            accessibilityState={{ expanded: categoryPickerOpen }}
            onPress={() => setCategoryPickerOpen(open => !open)}
            style={[
              styles.askCategorySelect,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: categoryPickerOpen ? colors.accent : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.askCategoryIcon,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <FontAwesome5
                name="folder-open"
                size={17}
                color={colors.accent}
                iconStyle="solid"
              />
            </View>
            <Text style={[styles.askCategoryValue, { color: colors.text }]}>
              {category?.name || 'Select a category'}
            </Text>
            <FontAwesome5
              name={categoryPickerOpen ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={colors.muted}
              iconStyle="solid"
            />
          </Pressable>
          {categoryPickerOpen ? (
            <View style={styles.askCategoryOptions}>
              {permittedCategories.map(item => (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: category?.id === item.id }}
                  onPress={() => {
                    setCategory(item);
                    setCategoryPickerOpen(false);
                  }}
                  style={[
                    styles.askCategoryOption,
                    {
                      backgroundColor:
                        category?.id === item.id
                          ? colors.accentSoft
                          : colors.surface,
                      borderColor:
                        category?.id === item.id
                          ? colors.accent
                          : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.categoryTitle, { color: colors.text }]}>
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View
            style={[styles.askDivider, { backgroundColor: colors.border }]}
          />
          <Text style={[styles.askFieldLabel, { color: colors.muted }]}>
            Your question
          </Text>
          <Text style={[styles.askFieldHelp, { color: colors.muted }]}>
            Be specific and clear so members can offer useful guidance.
          </Text>
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
                backgroundColor: colors.surfaceRaised,
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
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            textAlignVertical="top"
            value={question.raw}
          />
          <AttachmentComposer
            queue={attachmentQueue}
            disabled={question.submitting}
          />
        </View>
      ) : null}
      {!data.loading && !permittedCategories.length ? (
        <StateCard
          icon="folder-open"
          title="Asking is unavailable"
          body="Your account is not currently permitted to create a discussion in an available category."
        />
      ) : null}
      {permittedCategories.length ? (
        <>
          {question.error ? (
            <Text
              accessibilityRole="alert"
              style={[styles.composerError, { color: colors.danger }]}
            >
              {question.error}
            </Text>
          ) : null}
          <Card
            style={[
              styles.safety,
              {
                backgroundColor: colors.accentSoft,
                borderColor: colors.border,
              },
            ]}
          >
            <FontAwesome5
              name="shield-alt"
              size={18}
              color={colors.accent}
              iconStyle="solid"
            />
            <View style={styles.safetyCopy}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Privacy-safe by design
              </Text>
              <Text style={[styles.cardBody, { color: colors.muted }]}>
                Keep names, addresses, policy or claim numbers, claim-specific
                photos or documents, and identifying facts out of your question.
              </Text>
            </View>
          </Card>
          <Action
            label={
              question.submitting
                ? 'Working…'
                : question.uncertainSince
                ? 'Check posting status'
                : 'Ask the Network'
            }
            icon="pen"
            disabled={
              question.submitting ||
              !category ||
              !question.title.trim() ||
              (!question.raw.trim() && !attachmentQueue.attachments.length)
            }
            onPress={
              question.uncertainSince ? checkQuestionStatus : submitQuestion
            }
          />
          <Text style={[styles.finePrint, { color: colors.muted }]}>
            Your post is members-only under the network’s current access rules.
            Review it once more before publishing.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

export function IntelligenceScreen({ navigation, screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const rows = [
    {
      icon: 'newspaper',
      shortTitle: 'Today',
      label: 'DAILY BRIEFING',
      title: 'Today in Claims',
      body: 'A concise source-backed daily briefing.',
      path: '/tag/today-in-claims',
      tone: '#E2EFF1',
      iconColor: '#176B87',
    },
    {
      icon: 'cloud-rain',
      shortTitle: 'Weather',
      label: 'CAT CONTEXT',
      title: 'Claims Weather',
      body: 'Compact CAT and weather context for field decisions.',
      path: '/tag/claims-weather',
      tone: '#E6F2F5',
      iconColor: '#18839A',
    },
    {
      icon: 'toolbox',
      shortTitle: 'Knowledge',
      label: 'PRACTICE LIBRARY',
      title: 'Field Knowledge',
      body: 'Practical methods contributed by working adjusters.',
      path: '/tag/field-knowledge',
      tone: '#E8F3EC',
      iconColor: '#357A63',
    },
  ];
  const openDesk = row => screenProps.openUrl(`${site.url}${row.path}`);
  return (
    <Screen>
      <FloorHeader navigation={navigation} screenProps={screenProps} />
      <View style={styles.intelPageIntro}>
        <Text style={[styles.v2PageTitle, { color: colors.text }]}>Intel</Text>
        <Text style={[styles.v2PageSubtitle, { color: colors.muted }]}>
          Stay informed. Work smarter.
        </Text>
      </View>
      <View style={[styles.intelTabs, { borderBottomColor: colors.border }]}>
        {rows.map((row, index) => (
          <Pressable
            key={row.shortTitle}
            accessibilityRole="link"
            accessibilityLabel={`Open ${row.title}`}
            onPress={() => openDesk(row)}
            style={({ pressed }) => [
              styles.intelTab,
              index === 0 && {
                borderBottomColor: colors.brandAccent,
                borderBottomWidth: 3,
              },
              pressed && { opacity: 0.65 },
            ]}
          >
            <Text
              style={[
                styles.intelTabText,
                {
                  color: index === 0 ? colors.brandAccent : colors.muted,
                },
              ]}
            >
              {row.shortTitle}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.intelSectionHeading}>
        <View style={styles.intelSectionCopy}>
          <Text style={[styles.intelSectionTitle, { color: colors.text }]}>
            Intelligence desks
          </Text>
          <Text style={[styles.intelSectionDetail, { color: colors.muted }]}>
            Source-backed material published for Network members.
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.intelFeed,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {rows.map((row, index) => (
          <Pressable
            key={row.title}
            accessibilityRole="link"
            onPress={() => openDesk(row)}
            style={({ pressed }) => [
              styles.intelFeedRow,
              index < rows.length - 1 && {
                borderBottomColor: colors.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
              {
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View
              accessibilityElementsHidden
              style={[styles.intelFeedRail, { backgroundColor: row.iconColor }]}
            />
            <View
              style={[
                styles.intelFeedIcon,
                {
                  backgroundColor: colors.isDark ? colors.accentSoft : row.tone,
                },
              ]}
            >
              <FontAwesome5
                name={row.icon}
                size={22}
                color={colors.isDark ? colors.accent : row.iconColor}
                iconStyle="solid"
              />
            </View>
            <View style={styles.intelFeedCopy}>
              <Text
                style={[
                  styles.intelFeedLabel,
                  { color: colors.isDark ? colors.accent : row.iconColor },
                ]}
              >
                {row.label}
              </Text>
              <Text style={[styles.intelFeedTitle, { color: colors.text }]}>
                {row.title}
              </Text>
              <Text style={[styles.intelFeedBody, { color: colors.muted }]}>
                {row.body}
              </Text>
              <Text style={[styles.intelFeedAction, { color: colors.accent }]}>
                Open desk
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
      </View>
      <View style={styles.intelSectionHeading}>
        <View style={styles.intelSectionCopy}>
          <Text style={[styles.intelSectionTitle, { color: colors.text }]}>
            Saved intelligence
          </Text>
          <Text style={[styles.intelSectionDetail, { color: colors.muted }]}>
            Briefings and field knowledge you saved for later.
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => navigation.navigate('Bookmarks')}
          hitSlop={8}
        >
          <Text style={[styles.intelViewAll, { color: colors.accent }]}>
            View all
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => navigation.navigate('Bookmarks')}
        style={({ pressed }) => [
          styles.intelSavedRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.intelSavedIcon,
            { backgroundColor: colors.accentSoft },
          ]}
        >
          <FontAwesome5
            name="bookmark"
            size={18}
            color={colors.accent}
            iconStyle="solid"
          />
        </View>
        <View style={styles.intelFeedCopy}>
          <Text style={[styles.intelFeedTitle, { color: colors.text }]}>
            Your saved knowledge
          </Text>
          <Text style={[styles.intelFeedBody, { color: colors.muted }]}>
            Revisit member content without searching again.
          </Text>
        </View>
        <FontAwesome5
          name="chevron-right"
          size={14}
          color={colors.muted}
          iconStyle="solid"
        />
      </Pressable>
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
  const licensedStates = Array.isArray(adjusterCard?.values.licensed_states)
    ? adjusterCard.values.licensed_states
    : [];
  const profileFacts = [
    [
      'Location',
      adjusterCard?.values.base_state
        ? stateLabel(adjusterCard.values.base_state)
        : null,
    ],
    [
      'Adjuster type',
      adjusterCard?.values.adjuster_type
        ? optionLabel('adjuster_type', adjusterCard.values.adjuster_type)
        : null,
    ],
    [
      'Experience',
      adjusterCard?.values.years_experience
        ? optionLabel('years_experience', adjusterCard.values.years_experience)
        : null,
    ],
    [
      'CAT',
      adjusterCard?.values.cat_experience
        ? optionLabel('cat_experience', adjusterCard.values.cat_experience)
        : null,
    ],
    [
      'Work mode',
      adjusterCard?.values.work_mode
        ? optionLabel('work_mode', adjusterCard.values.work_mode)
        : null,
    ],
  ].filter(([, value]) => value);
  return (
    <Screen>
      <FloorHeader navigation={navigation} screenProps={screenProps} />
      <View style={styles.v2PageIntro}>
        <Text style={[styles.v2PageTitle, { color: colors.text }]}>You</Text>
        <Text style={[styles.v2PageSubtitle, { color: colors.muted }]}>
          Manage your professional identity and activity.
        </Text>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Open your Adjuster Card"
        onPress={() => screenProps.openUrl(`${site.url}/u/${username}`)}
        style={({ pressed }) => [
          styles.identity,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            opacity: pressed ? 0.76 : 1,
          },
        ]}
      >
        <View style={styles.identityTop}>
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
            <Text style={[styles.identityName, { color: colors.text }]}>
              {adjusterCard?.values.name || username}
            </Text>
            <Text style={[styles.identityHeadline, { color: colors.text }]}>
              {adjusterCard?.values.professional_headline ||
                'Adjuster Network member'}
            </Text>
            {adjusterCard?.values.base_state ? (
              <View style={styles.identityLocation}>
                <FontAwesome5
                  name="map-marker-alt"
                  size={12}
                  color={colors.muted}
                  iconStyle="solid"
                />
                <Text style={[styles.identityDetail, { color: colors.muted }]}>
                  {stateLabel(adjusterCard.values.base_state)}
                </Text>
              </View>
            ) : null}
          </View>
          <FontAwesome5
            name="chevron-right"
            size={16}
            color={colors.muted}
            iconStyle="solid"
          />
        </View>
        <View
          style={[styles.identitySummary, { borderTopColor: colors.border }]}
        >
          <ProfileSummaryMetric
            label="Licensed"
            value={licensedStates.length ? licensedStates.join(' · ') : '—'}
          />
          <ProfileSummaryMetric
            label="Experience"
            value={
              adjusterCard?.values.years_experience
                ? optionLabel(
                    'years_experience',
                    adjusterCard.values.years_experience,
                  )
                : '—'
            }
          />
          <ProfileSummaryMetric
            label="Work mode"
            value={
              adjusterCard?.values.work_mode
                ? optionLabel('work_mode', adjusterCard.values.work_mode)
                : '—'
            }
          />
        </View>
      </Pressable>
      <View
        style={[
          styles.profileQuickActions,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}
      >
        <ProfileQuickAction
          icon="user-edit"
          label="Edit profile"
          onPress={() => screenProps.openUrl(`${site.url}/u/${username}`)}
        />
        <ProfileQuickAction
          icon="bookmark"
          label="Saved items"
          onPress={() => navigation.navigate('Bookmarks')}
        />
        <ProfileQuickAction
          icon="history"
          label="Activity"
          onPress={() =>
            screenProps.openUrl(`${site.url}/u/${username}/activity`)
          }
        />
        <ProfileQuickAction
          icon="search"
          label="Search"
          onPress={() => navigation.navigate('Search')}
        />
      </View>
      {(adjusterCard?.values.bio || profileFacts.length > 0) && (
        <>
          <SectionTitle
            title="Professional profile"
            detail="Credentials and field experience shared with the Network."
          />
          <View
            style={[
              styles.professionalProfile,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
              },
            ]}
          >
            {adjusterCard?.values.bio ? (
              <View style={styles.professionalAbout}>
                <Text
                  style={[styles.professionalLabel, { color: colors.muted }]}
                >
                  ABOUT
                </Text>
                <Text style={[styles.professionalBio, { color: colors.text }]}>
                  {adjusterCard.values.bio}
                </Text>
              </View>
            ) : null}
            <View style={styles.professionalFacts}>
              {profileFacts
                .filter(
                  ([label]) =>
                    !['Location', 'Experience', 'Work mode'].includes(label),
                )
                .map(([label, value]) => (
                  <View key={label} style={styles.professionalFact}>
                    <Text
                      style={[
                        styles.professionalLabel,
                        { color: colors.muted },
                      ]}
                    >
                      {label.toUpperCase()}
                    </Text>
                    <Text
                      style={[styles.professionalValue, { color: colors.text }]}
                    >
                      {value}
                    </Text>
                  </View>
                ))}
            </View>
            {Array.isArray(adjusterCard?.values.specialties) &&
            adjusterCard.values.specialties.length ? (
              <View style={styles.specialtiesBlock}>
                <Text
                  style={[styles.professionalLabel, { color: colors.muted }]}
                >
                  SPECIALTIES
                </Text>
                <View style={styles.identityTags}>
                  {adjusterCard.values.specialties.map(value => (
                    <View
                      key={value}
                      style={[
                        styles.identityTag,
                        { backgroundColor: colors.surfaceAlt },
                      ]}
                    >
                      <Text
                        style={[styles.identityTagText, { color: colors.text }]}
                      >
                        {optionLabel('specialties', value)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </>
      )}
      <SectionTitle
        title="Account & preferences"
        detail="Security, notifications, privacy, and device controls."
      />
      <View
        style={[
          styles.profileSettingsPanel,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}
      >
        {adjusterNetwork.features.pushEducation ? (
          <NotificationEducation
            status={screenProps.pushStatus}
            attemptResult={screenProps.pushAttemptResult}
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
          label="Account settings"
          onPress={() =>
            screenProps.openUrl(`${site.url}/u/${username}/preferences/account`)
          }
        />
        <ProfileLink
          icon="lock"
          label="Privacy & account"
          onPress={() => navigation.navigate('PrivacyAccount')}
        />
      </View>
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

const ProfileQuickAction = ({ icon, label, onPress }) => {
  const colors = useProductTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.profileQuickAction}
    >
      <View
        style={[
          styles.profileQuickIcon,
          { backgroundColor: colors.accentSoft },
        ]}
      >
        <FontAwesome5
          name={icon}
          size={18}
          color={colors.accent}
          iconStyle="solid"
        />
      </View>
      <Text style={[styles.profileQuickLabel, { color: colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
};

const ProfileSummaryMetric = ({ label, value }) => {
  const colors = useProductTheme();
  return (
    <View style={styles.identitySummaryMetric}>
      <Text style={[styles.identitySummaryLabel, { color: colors.muted }]}>
        {label}
      </Text>
      <Text
        numberOfLines={2}
        style={[styles.identitySummaryValue, { color: colors.text }]}
      >
        {value}
      </Text>
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
  v2PageIntro: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  v2PageTitle: { ...type.title, fontSize: 24, lineHeight: 30 },
  v2PageSubtitle: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
    maxWidth: 620,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorHeader: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 2,
  },
  floorLogo: {
    width: floorV2.headerLogoWidth,
    height: floorV2.headerLogoHeight,
  },
  floorGreeting: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  floorGreetingTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  floorGreetingBody: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  floorAttentionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  floorAttentionHeadingTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '820',
  },
  floorAttentionHint: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  floorAttentionScroller: { marginHorizontal: -spacing.md },
  floorAttentionRail: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: 4,
  },
  floorAttentionCard: {
    minHeight: 156,
    borderRadius: floorV2.cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    overflow: 'hidden',
    ...elevation.subtle,
  },
  floorAttentionAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  floorAttentionTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  floorAttentionCategory: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '820',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  floorAttentionState: {
    minHeight: 25,
    borderRadius: 13,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  floorAttentionStateText: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '850',
    letterSpacing: 0.55,
  },
  floorAttentionTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: spacing.sm,
    minHeight: 46,
  },
  floorAttentionFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  floorAttentionIdentity: { flex: 1, minWidth: 0 },
  floorAttentionAuthor: { fontSize: 12, lineHeight: 16, fontWeight: '750' },
  floorAttentionMeta: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  floorAttentionEmpty: {
    minHeight: 92,
    borderRadius: floorV2.cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    justifyContent: 'center',
  },
  floorAttentionEmptyText: { fontSize: 13, lineHeight: 18 },
  floorActionsHeading: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floorActionsHeadingAccessible: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  floorActionsTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  floorStats: {
    flexDirection: 'row',
    gap: 5,
    marginTop: spacing.xs,
  },
  floorStatsAccessible: { flexWrap: 'wrap' },
  floorStat: {
    flex: 1,
    minHeight: 132,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: floorV2.controlRadius,
    padding: 8,
  },
  floorStatAccessible: { flexBasis: '47%', flexGrow: 1 },
  floorStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorStatValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '820',
    marginTop: spacing.xs,
  },
  floorStatLabel: { fontSize: 10, lineHeight: 13, fontWeight: '700' },
  floorStatDetail: { fontSize: 9, lineHeight: 12, marginTop: 2 },
  floorStatArrow: { alignSelf: 'flex-end', marginTop: 'auto' },
  floorSectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: floorV2.sectionGap,
    paddingBottom: spacing.xs,
  },
  floorSectionHeadingAccessible: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  floorSectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800' },
  floorSectionDetail: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  floorSeeAll: { fontSize: 13, lineHeight: 18, fontWeight: '750' },
  floorActivityFeed: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: floorV2.cardRadius,
    overflow: 'hidden',
    ...elevation.subtle,
  },
  floorActivityRow: {
    minHeight: 96,
    borderBottomWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  floorActivityContext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  floorActivityCategory: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  floorActivityDate: { fontSize: 10, lineHeight: 14 },
  floorActivityTitle: { fontSize: 15, lineHeight: 20, fontWeight: '750' },
  floorActivityMeta: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  floorActivityArrow: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorProfileCta: {
    minHeight: 72,
    borderRadius: floorV2.controlRadius,
    marginTop: floorV2.sectionGap,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  floorProfileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorProfileTitle: { fontSize: 15, lineHeight: 20, fontWeight: '750' },
  floorProfileBody: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  floorPressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  discussionsTitleBlock: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  discussionsTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  discussionsSubtitle: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  discussionsSegments: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  discussionsSegment: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussionsSegmentLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '750',
  },
  discussionsSegmentIndicator: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: -1,
    height: 3,
    borderRadius: 2,
  },
  discussionsSectionHeading: {
    minHeight: 34,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  discussionsSectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.12,
  },
  discussionsSectionDetail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  discussionCategoryList: { gap: 4 },
  discussionCategoryRow: {
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  discussionCategoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussionCategoryName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '780',
  },
  discussionCategoryDescription: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  discussionCategoryCount: { minWidth: 34, alignItems: 'center' },
  discussionCategoryCountValue: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  discussionCategoryCountLabel: { fontSize: 9, lineHeight: 12 },
  discussionFeed: {
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'hidden',
    ...elevation.subtle,
  },
  discussionFeedRow: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  discussionUnreadSlot: { width: 9, alignItems: 'flex-end' },
  discussionUnreadDot: { width: 6, height: 6, borderRadius: 3 },
  discussionFeedTitle: { fontSize: 14, lineHeight: 19, fontWeight: '750' },
  discussionFeedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  discussionFeedAuthor: { maxWidth: 110, fontSize: 10, lineHeight: 14 },
  discussionFeedMetaText: { fontSize: 10, lineHeight: 14 },
  discussionFeedCategory: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  discussionReplyBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussionReplyBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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
  welcomeRule: {
    width: 46,
    height: 3,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 2,
  },
  welcomeBody: { fontSize: 16, lineHeight: 23 },
  valueCard: {
    padding: 14,
    borderRadius: radius.lg,
    gap: 12,
    marginVertical: 2,
  },
  value: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  valueIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueCopy: { flex: 1 },
  valueTitle: { fontSize: 16, fontWeight: '750' },
  valueBody: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  finePrint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
  welcomePrimary: {
    minHeight: 54,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  welcomePrimaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  welcomeSecondary: {
    minHeight: 54,
    borderWidth: 1.5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  welcomeSecondaryText: { fontSize: 17, fontWeight: '800' },
  welcomePrivacy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
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
    borderRadius: 13,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    marginBottom: spacing.sm,
  },
  composerBodyInput: {
    minHeight: 150,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 13,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    borderLeftColor: '#176B87',
    borderRadius: 14,
    marginBottom: spacing.sm,
  },
  safetyCopy: { flex: 1 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.md,
  },
  category: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryTitle: { fontSize: 15, fontWeight: '750' },
  askComposerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  askFieldLabel: { fontSize: 14, lineHeight: 19, fontWeight: '750' },
  askFieldHelp: { fontSize: 13, lineHeight: 18, marginTop: 2, marginBottom: 8 },
  askCategorySelect: {
    minHeight: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 13,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  askCategoryIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askCategoryValue: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '750',
  },
  askCategoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  askCategoryOption: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  askDivider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.md },
  intro: { fontSize: 16, lineHeight: 24, marginBottom: spacing.md },
  intelPageIntro: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  intelTabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  intelTab: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intelTabText: { fontSize: 14, lineHeight: 19, fontWeight: '750' },
  intelSectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  intelSectionCopy: { flex: 1 },
  intelSectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800' },
  intelSectionDetail: { ...type.metadata, marginTop: 2 },
  intelViewAll: { fontSize: 14, lineHeight: 20, fontWeight: '750' },
  intelFeed: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  intelFeedRow: {
    minHeight: 88,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  intelFeedRail: {
    position: 'absolute',
    left: 0,
    top: spacing.sm,
    bottom: spacing.sm,
    width: 3,
    borderRadius: 2,
  },
  intelFeedIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intelFeedCopy: { flex: 1 },
  intelFeedLabel: { ...type.label, fontSize: 9, lineHeight: 12 },
  intelFeedTitle: { ...type.topic },
  intelFeedBody: { ...type.metadata, marginTop: 2 },
  intelFeedAction: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '750',
    marginTop: 4,
  },
  intelSavedRow: {
    minHeight: 78,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  intelSavedIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: spacing.md,
    ...elevation.subtle,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  identityCopy: { flex: 1 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  identityName: { fontSize: 22, lineHeight: 27, fontWeight: '850' },
  identityHeadline: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '650',
    marginTop: 2,
  },
  identityLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  identityBio: { ...type.body, marginTop: spacing.xs },
  identityDetail: { ...type.meta },
  identitySummary: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  identitySummaryMetric: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(100, 116, 139, 0.22)',
  },
  identitySummaryLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  identitySummaryValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 3,
  },
  identityFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  identityFact: {
    flexBasis: '29%',
    flexGrow: 1,
    minWidth: 82,
    paddingVertical: 2,
  },
  identityFactLabel: { ...type.label, fontSize: 9, lineHeight: 13 },
  identityFactValue: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '750',
    marginTop: 2,
  },
  specialtiesBlock: { marginTop: spacing.xs },
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
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  profileQuickActions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  profileQuickAction: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: 4,
  },
  profileQuickIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileQuickLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '750',
    textAlign: 'center',
  },
  professionalProfile: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: spacing.md,
  },
  professionalAbout: { marginBottom: spacing.sm },
  professionalLabel: { ...type.label, fontSize: 9, lineHeight: 13 },
  professionalBio: { fontSize: 14, lineHeight: 20, marginTop: 3 },
  professionalFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  professionalFact: { flex: 1, minWidth: 120 },
  professionalValue: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '750',
    marginTop: 2,
  },
  profileSettingsPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  profileLabel: { fontSize: 16, fontWeight: '650' },
  notificationEducation: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  notificationEducationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationEnable: {
    minHeight: 36,
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationActionText: { fontSize: 13, lineHeight: 18, fontWeight: '750' },
  notificationAttempt: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '650',
  },
});
