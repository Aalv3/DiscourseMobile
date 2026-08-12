/* @flow */
'use strict';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Action,
  Card,
  PageHeader,
  Pill,
  SectionTitle,
  StateCard,
  useProductTheme,
} from './ProductComponents';
import { activeMemberSite, loadCommunity, topicPath } from './ProductData';
import { radius, spacing } from './DesignSystem';

const ONBOARDING_KEY = '@AdjusterNetwork.onboarding.v1';
const interests = ['CAT & Storm', 'Property', 'Auto', 'Field Tools', 'Career'];

const Screen = ({ children }) => {
  const colors = useProductTheme();
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.canvas }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView contentContainerStyle={styles.scroll}>{children}</ScrollView>
    </SafeAreaView>
  );
};

export function WelcomeScreen({ onConnect, onLogin, busy }) {
  const colors = useProductTheme();
  const { width } = useWindowDimensions();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.welcome,
          width >= 700 && styles.welcomeWide,
        ]}
      >
        <View style={styles.brandLogoPlate}>
          <Image
            source={require('../../img/adjuster-network-logo.png')}
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

function useCommunity(siteManager) {
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
  }, [siteManager]);
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
          {topic.posts_count || 0} replies · {topic.views || 0} views
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

export function FloorScreen({ screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const data = useCommunity(screenProps.siteManager);
  return (
    <Screen>
      <PageHeader eyebrow="Member briefing" title="The Floor" />
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

export function DiscussionsScreen({ screenProps }) {
  const site = activeMemberSite(screenProps.siteManager);
  const data = useCommunity(screenProps.siteManager);
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
      <PageHeader eyebrow="Members only" title="Discussions" />
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

export function AskScreen({ screenProps }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const data = useCommunity(screenProps.siteManager);
  const [category, setCategory] = useState(null);
  const compose = () =>
    screenProps.openUrl(
      `${site.url}/new-topic${
        category ? `?category=${category.slug || category.id}` : ''
      }`,
    );
  return (
    <Screen>
      <PageHeader
        eyebrow="A better question gets a better answer"
        title="Ask the Network"
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
        {data.categories.map(item => (
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
      {!data.loading && !data.categories.length ? (
        <StateCard
          icon="folder-open"
          title="No categories available"
          body="The network has not exposed a category for native posting yet. You can still open the members-only composer and choose there."
        />
      ) : null}
      <Action
        label="Continue to private composer"
        icon="pen"
        onPress={compose}
      />
      <Text style={[styles.finePrint, { color: colors.muted }]}>
        Your post is members-only under the network’s current access rules.
        Review it once more before publishing.
      </Text>
    </Screen>
  );
}

export function IntelligenceScreen({ screenProps }) {
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
      <PageHeader eyebrow="Signal, not noise" title="Intelligence" />
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

export function ProfileScreen({ screenProps, navigation }) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const username = site?.username || 'Member';
  return (
    <Screen>
      <PageHeader eyebrow="Private member account" title="You" />
      <Card style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={styles.avatarText}>
            {username.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={[styles.identityName, { color: colors.text }]}>
            {username}
          </Text>
          <Text style={[styles.cardBody, { color: colors.muted }]}>
            Adjuster Network member
          </Text>
        </View>
      </Card>
      <SectionTitle title="Account" />
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
        onPress={() => navigation.navigate('Settings')}
      />
      <Text style={[styles.finePrint, { color: colors.muted }]}>
        Only safe basic identity is shown here. Advanced professional fields are
        not collected in the native app.
      </Text>
    </Screen>
  );
}

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

export function OnboardingScreen({ onFinish }) {
  const colors = useProductTheme();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState([]);
  const steps = [
    {
      icon: 'hand-paper',
      title: 'Welcome to the Network',
      body: 'A focused home for adjusters to learn from peers and keep up with claims.',
    },
    {
      icon: 'lock',
      title: 'Private by default',
      body: 'Member discussions are private. Public owner resources are separate; never assume a post is public.',
    },
    {
      icon: 'shield-alt',
      title: 'No claim data. Ever.',
      body: 'Leave out names, addresses, identifiers, documents, photos, and any facts that could identify a claim.',
    },
    {
      icon: 'user-check',
      title: 'Keep your profile simple',
      body: 'Use only the basic professional context you are comfortable sharing with other members.',
    },
  ];
  const finish = async () => {
    await AsyncStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ completed: true, interests: selected }),
    );
    onFinish();
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <View style={styles.onboarding}>
        <View style={styles.progress}>
          {[0, 1, 2, 3, 4].map(i => (
            <View
              key={i}
              style={[
                styles.progressBar,
                { backgroundColor: i <= step ? colors.accent : colors.border },
              ]}
            />
          ))}
        </View>
        {step < 4 ? (
          <>
            <View
              style={[
                styles.onboardingIcon,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <FontAwesome5
                name={steps[step].icon}
                size={30}
                color={colors.accent}
                iconStyle="solid"
              />
            </View>
            <Text
              accessibilityRole="header"
              style={[styles.onboardingTitle, { color: colors.text }]}
            >
              {steps[step].title}
            </Text>
            <Text style={[styles.onboardingBody, { color: colors.muted }]}>
              {steps[step].body}
            </Text>
          </>
        ) : (
          <>
            <Text
              accessibilityRole="header"
              style={[styles.onboardingTitle, { color: colors.text }]}
            >
              What do you work with?
            </Text>
            <Text style={[styles.onboardingBody, { color: colors.muted }]}>
              Optional. Pick any topics you want to find faster.
            </Text>
            <View style={styles.interests}>
              {interests.map(item => (
                <Pill
                  key={item}
                  label={item}
                  selected={selected.includes(item)}
                  onPress={() =>
                    setSelected(current =>
                      current.includes(item)
                        ? current.filter(x => x !== item)
                        : [...current, item],
                    )
                  }
                />
              ))}
            </View>
          </>
        )}
        <View style={styles.onboardingActions}>
          {step < 4 ? (
            <Action label="Continue" onPress={() => setStep(step + 1)} />
          ) : (
            <Action
              label="Start on the Floor"
              icon="arrow-right"
              onPress={finish}
            />
          )}
          {step > 0 ? (
            <Action label="Back" secondary onPress={() => setStep(step - 1)} />
          ) : null}
          <Pressable accessibilityRole="button" onPress={finish}>
            <Text style={[styles.skip, { color: colors.muted }]}>
              Skip for now
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export async function onboardingComplete() {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  try {
    return Boolean(value && JSON.parse(value).completed);
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
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
    padding: spacing.lg,
    justifyContent: 'center',
    gap: 14,
  },
  welcomeWide: { paddingVertical: 50 },
  brandLogoPlate: {
    width: 260,
    height: 186,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    overflow: 'hidden',
  },
  // An explicit height prevents Fabric from falling back to the PNG's Retina
  // pixel dimensions while it resolves the intrinsic image size.
  brandLogo: { width: 240, height: 171, aspectRatio: 1183 / 845 },
  welcomeTitle: { fontSize: 38, lineHeight: 44, fontWeight: '850' },
  welcomeBody: { fontSize: 18, lineHeight: 27 },
  valueCard: {
    padding: 18,
    borderRadius: radius.lg,
    gap: 18,
    marginVertical: 6,
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
  onboarding: {
    flex: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    padding: spacing.lg,
  },
  progress: { flexDirection: 'row', gap: 6 },
  progressBar: { height: 4, flex: 1, borderRadius: 2 },
  onboardingIcon: {
    marginTop: 60,
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingTitle: {
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '850',
    marginTop: 24,
  },
  onboardingBody: { fontSize: 18, lineHeight: 27, marginTop: 12 },
  onboardingActions: { marginTop: 'auto', gap: 10 },
  skip: { textAlign: 'center', padding: 12, fontSize: 15, fontWeight: '600' },
  interests: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
});
