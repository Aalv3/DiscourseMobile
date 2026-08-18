/* @flow */
'use strict';

import React from 'react';
import { ThemeContext, themes } from './ThemeContext';
import {
  Alert,
  Appearance,
  AppState,
  Linking,
  Platform,
  NativeModules,
  NativeEventEmitter,
  Settings,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  createStackNavigator,
  TransitionPresets,
} from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { initialPushNotification } from './initialPushNotification';
import Screens from './screens';
import Site from './site';
import SiteManager from './site_manager';
import SafariView from 'react-native-safari-view';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18n-js';
import * as RNLocalize from 'react-native-localize';
import { addShortcutListener } from 'react-native-siri-shortcut';
import { enableScreens } from 'react-native-screens';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import { adjusterNetwork } from './adjusterNetworkConfig';
import {
  classifyNavigation,
  isCanonicalUrl,
  securityEvent,
} from './adjusterNetworkSecurity';
import { BlurView } from '@react-native-community/blur';
import { PushFoundation } from './pushFoundation';
import { PushBackendClient } from './pushBackendClient';
import { pushInstallationStore } from './pushInstallationStore';
import { recordPushRegistrationResult } from './pushRegistrationDiagnostics';
import {
  PUSH_REGISTRATION_STAGE,
  resultFromPushError,
  startedPushRegistration,
} from './pushRegistrationResult';
import { pushTransport } from './platforms/push-transport';
import {
  PendingPushRoute,
  shouldObserveRemoteNotifications,
} from './pushRouting';

import BackgroundFetch from './platforms/background-fetch';
import {
  shouldOpenCallbackOneTimePassword,
  shouldReportAuthFailureAfterSettlement,
} from './authAttempt';
import {
  AUTH_FAILURE,
  authFailureAlert,
  classifyAuthFailure,
} from './authFailure';
import {
  AskScreen,
  DiscussionsScreen,
  FloorScreen,
  IntelligenceScreen,
  LoungeScreen,
  ProfileScreen,
  WelcomeScreen,
} from './product/ProductScreens';
import OnboardingScreen from './product/AdjusterCardOnboardingScreen';
import { productTheme } from './product/DesignSystem';
import { NestedHeader, V2BrandHeader } from './product/ProductComponents';
import {
  AccountScreen,
  AppearanceSettingsScreen,
  NativeBookmarksScreen,
  NativeSearchScreen,
  NotificationSettingsScreen,
  PrivacyAccountScreen,
} from './product/NativeMemberUtilityScreens';
import NativeTopicScreen from './product/NativeTopicScreen';
import NativeCollectionScreen from './product/NativeCollectionScreen';
import NativeProfileScreen from './product/NativeProfileScreen';
import { classifyFirstPartyMemberRoute } from './nativeMemberRouting';
import {
  loadOnboardingState,
  onboardingSessionId,
  ONBOARDING_STATUS,
  recordOnboardingAuditTrace,
  shouldShowOnboarding,
} from './onboardingState';
import {
  loadCanonicalOnboarding,
  localStatusForProgress,
} from './adjusterCardClient';

const { DiscourseKeyboardShortcuts } = NativeModules;

// It's not ideal that we have to manually register languages here
// but react-native doesn't make it easy to loop through files in a folder
// there's react-native-fs, but I hesitate to add another dependency just for that
i18n.translations = {
  ar: require('./locale/ar.json'),
  de: require('./locale/de.json'),
  en: require('./locale/en.json'),
  es: require('./locale/es.json'),
  fa: require('./locale/fa_IR.json'),
  fi: require('./locale/fi.json'),
  fr: require('./locale/fr.json'),
  he: require('./locale/he.json'),
  it: require('./locale/it.json'),
  ja: require('./locale/ja.json'),
  ko: require('./locale/ko.json'),
  lt: require('./locale/lt.json'),
  nl: require('./locale/nl.json'),
  'pt-BR': require('./locale/pt_BR.json'),
  ru: require('./locale/ru.json'),
  tr: require('./locale/tr_TR.json'),
  ug: require('./locale/ug.json'),
  vi: require('./locale/vi.json'),
  'zh-CN': require('./locale/zh_CN.json'),
};

const { languageTag } = RNLocalize.findBestAvailableLanguage(
  Object.keys(i18n.translations),
) || { languageTag: 'en', isRTL: false };

i18n.locale = languageTag;
i18n.fallbacks = true;

enableScreens();

// TODO: Use NativeStackNavigator instead?
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

class Discourse extends React.Component {
  refreshTimerId = null;

  _onboardingLoadGeneration = 0;

  _pushRestoreSessionId = null;

  constructor(props) {
    super(props);
    this._siteManager = new SiteManager();
    this._pushRoute = new PendingPushRoute();
    this._pushFoundation = new PushFoundation({
      enabled:
        adjusterNetwork.features.pushDelivery &&
        Boolean(adjusterNetwork.push.environment),
      environment: adjusterNetwork.push.environment,
      appId: 'org.adjusternetwork.app',
      appVersion: DeviceInfo.getVersion(),
      build: DeviceInfo.getBuildNumber(),
      store: pushInstallationStore,
      transport: pushTransport,
      client: new PushBackendClient({
        origin: adjusterNetwork.push.backendOrigin,
        nonceFactory: () => pushInstallationStore.requestNonce(),
      }),
      onResult: recordPushRegistrationResult,
    });
    this._siteManager.setPushFoundation(this._pushFoundation);
    this._refresh = this._refresh.bind(this);
    this._initBackgroundFetch = this._initBackgroundFetch.bind(this);

    this._handleAppStateChange = nextAppState => {
      if (nextAppState.match(/inactive|background/)) {
        this._seenNotificationMap = null;
        clearTimeout(this.refreshTimerId);
        this.setState({ privacyShield: true });
      } else {
        this.setState({ privacyShield: false });
        StatusBar.setHidden(false);
        this._siteManager.refreshSites();
        this._consumeShareIntent();

        clearTimeout(this.refreshTimerId);
        this.refreshTimerId = setTimeout(this._refresh, 30000);
      }
    };

    this._handleOpenUrl = this._handleOpenUrl.bind(this);
    this._consumeShareIntent = this._consumeShareIntent.bind(this);
    this._flushPendingPushRoute = this._flushPendingPushRoute.bind(this);

    if (
      shouldObserveRemoteNotifications(
        Platform.OS,
        adjusterNetwork.features.pushDelivery,
      )
    ) {
      PushNotificationIOS.addEventListener('notification', e =>
        this._handleNotification(e),
      );

      initialPushNotification(PushNotificationIOS).then(e => {
        if (e) {
          this._handleNotification(e);
        }
      });
    }

    if (adjusterNetwork.features.push && Platform.OS === 'ios') {
      // local notifications, triggered via background fetch
      // for non-hosted sites only (sites where hasPush = false)
      PushNotificationIOS.addEventListener('localNotification', e =>
        this._handleNotification(e),
      );
    }

    const largerUI =
      DeviceInfo.getDeviceType() === 'Tablet' ||
      DeviceInfo.getDeviceType() === 'Desktop';

    this.state = {
      deviceId: DeviceInfo.getDeviceId(),
      largerUI: largerUI,
      theme: themes.light,
      themePreference: 'light',
      privacyShield: false,
      signedIn: false,
      onboardingReady: false,
      onboardingStatus: ONBOARDING_STATUS.NOT_STARTED,
      onboardingSessionId: null,
      onboardingDismissedForSession: false,
      connecting: false,
      pushStatus: 'unknown',
      pushAttemptResult: null,
      memberContentVersion: 0,
    };

    this.subscription = Appearance.addChangeListener(() => {
      if (this.state.themePreference !== 'system') return;
      const newColorScheme = Appearance.getColorScheme();
      this.setState({
        theme: newColorScheme === 'dark' ? themes.dark : themes.light,
      });
    });

    AsyncStorage.getItem('@AdjusterNetwork.themePreference').then(value => {
      const preference = ['system', 'light', 'dark'].includes(value)
        ? value
        : 'light';
      const resolved =
        preference === 'system' ? Appearance.getColorScheme() : preference;
      this.setState({
        themePreference: preference,
        theme: resolved === 'dark' ? themes.dark : themes.light,
      });
    });

    // Toggle dark mode for older Androids (using a custom button in DebugRow)
    if (Platform.OS === 'android' && Platform.Version < 29) {
      AsyncStorage.getItem('@Discourse.androidLegacyTheme').then(
        storedTheme => {
          this.setState({
            theme:
              storedTheme && storedTheme === 'dark'
                ? themes.dark
                : themes.light,
          });
        },
      );
    }
  }

  _handleNotification(e) {
    if (!this._pushRoute.accept(e)) {
      securityEvent('push.route.rejected');
      return false;
    }
    securityEvent('push.route.pending');
    return this._flushPendingPushRoute();
  }

  _flushPendingPushRoute() {
    if (!this.state) {
      return false;
    }
    const site = this._siteManager.activeSite || this._siteManager.sites[0];
    const navigationReady = Boolean(
      this.state.signedIn &&
        this.state.onboardingReady &&
        (this.state.onboardingStatus === ONBOARDING_STATUS.COMPLETED ||
          this.state.onboardingDismissedForSession) &&
        this._navigation,
    );
    const routed = this._pushRoute.flush({
      origin: adjusterNetwork.canonicalOrigin,
      authenticated: Boolean(site?.authToken),
      navigationReady,
      openUrl: this.openUrl.bind(this),
    });
    if (!routed && this._pushRoute.path) {
      securityEvent('push.route.deferred');
    }
    if (routed) {
      securityEvent('push.route.opened');
    }
    return routed;
  }

  async _handleOpenUrl(event) {
    const kind = classifyNavigation(event && event.url);
    if (kind === 'callback') {
      const params = this._siteManager.parseURLparameters(event.url);
      const site = this._siteManager.activeSite;

      if (event.url === 'adjusternetwork://share') {
        await this._consumeShareIntent();
        return;
      }

      if (Platform.OS === 'ios' && Settings.get('external_links_svc')) {
        SafariView.dismiss();
      }

      // initial auth payload
      if (params.payload) {
        const accepted = await this._siteManager.handleAuthPayload(
          params.payload,
        );
        if (!accepted) {
          return;
        }
      }

      // received one-time-password request from SafariView
      if (params.otp && Platform.OS === 'ios') {
        try {
          const url = await this._siteManager.generateAuthURL(site);
          const authURL = await this._siteManager.requestAuth(url);

          if (!authURL) {
            this._navigation.navigate('Home');
            return;
          }
          this.openUrl(authURL);
        } catch {
          securityEvent('auth.otp.failed');
        }
      }

      // one-time-password received, launch site with it
      if (
        params.oneTimePassword &&
        shouldOpenCallbackOneTimePassword(Platform.OS)
      ) {
        const OTP = this._siteManager.decryptHelper(params.oneTimePassword);
        this.openUrl(`${site.url}/session/otp/${OTP}`);
      }

      // handle site URL passed via app-argument
      if (params.siteUrl) {
        if (this._siteManager.exists({ url: params.siteUrl })) {
          this.openUrl(params.siteUrl);
        } else {
          this._addSite(params.siteUrl);
        }
      }
    } else if (kind === 'internal') {
      // Handle URLs from Universal Links
      if (this._siteManager.urlInSites(event.url)) {
        this.openUrl(event.url);
      } else {
        this._addSite(adjusterNetwork.canonicalOrigin);
      }
    } else if (kind === 'external') {
      Linking.openURL(event.url).catch(() => {});
    }
  }

  async _consumeShareIntent() {
    const intent = await DiscourseKeyboardShortcuts?.consumeShareIntent?.();
    if (!intent) return false;
    const authenticated = this._siteManager
      .listSites()
      .find(candidate => candidate.authToken);
    if (!authenticated) {
      Alert.alert(
        'Sign in to share',
        'Open Adjuster Network and sign in before sharing member content.',
      );
      return false;
    }
    if (intent.kind === 'url') {
      this.openUrl(intent.value);
      return true;
    }
    if (intent.kind === 'text') {
      this._navigation?.navigate('HomeWrapper', {
        screen: 'Ask',
        params: { sharedText: intent.value, shareIntentId: intent.id },
      });
      return true;
    }
    return false;
  }

  componentDidMount() {
    this._productSiteSubscription = async () => {
      const loadGeneration = ++this._onboardingLoadGeneration;
      const site = this._siteManager
        .listSites()
        .find(candidate => candidate.authToken);
      const signedIn = Boolean(site);
      if (!signedIn) {
        this.setState({ signedIn: false }, this._flushPendingPushRoute);
        return;
      }

      const sessionId = onboardingSessionId(site);
      if (this._pushRestoreSessionId !== sessionId) {
        this._pushRestoreSessionId = sessionId;
        this._pushFoundation
          .status()
          .then(async preference => {
            this.setState({ pushStatus: preference });
            if (preference !== 'enabled') return;
            this.setState({ pushStatus: 'working' });
            try {
              const result = await this._pushFoundation.enable(site);
              this.setState({ pushStatus: result.category || result });
            } catch (error) {
              const result = resultFromPushError(
                error,
                PUSH_REGISTRATION_STAGE.UNKNOWN,
              );
              this.setState({
                pushStatus: result.category,
              });
            }
          })
          .catch(error => {
            const result = resultFromPushError(
              error,
              PUSH_REGISTRATION_STAGE.PERMISSION_CHECK,
            );
            recordPushRegistrationResult(result);
            this.setState({
              pushStatus: result.category,
            });
          });
      }
      if (
        !this.state.signedIn ||
        this.state.onboardingSessionId !== sessionId
      ) {
        const localOnboarding = await loadOnboardingState(undefined, sessionId);
        let onboarding = localOnboarding;
        try {
          const canonical = await loadCanonicalOnboarding(site);
          onboarding = {
            status: localStatusForProgress(canonical),
            dismissedSessionId:
              canonical.state === 'COMPLETED'
                ? null
                : localOnboarding.dismissedSessionId,
            completedAt:
              canonical.state === 'COMPLETED'
                ? localOnboarding.completedAt || 'server-confirmed'
                : null,
            schemaVersion: 3,
          };
        } catch {
          // The server contract is canonical when available. A transient load
          // failure must not let a legacy local completion override it. Keep
          // only the current-session dismissal marker and fail toward
          // incomplete; no structured profile value is stored locally.
          onboarding = {
            status: ONBOARDING_STATUS.INCOMPLETE,
            dismissedSessionId: localOnboarding.dismissedSessionId,
            completedAt: null,
            schemaVersion: 3,
          };
        }
        const onboardingRequired = shouldShowOnboarding(onboarding, sessionId);
        recordOnboardingAuditTrace([
          'AUTH_COMPLETE',
          'ONBOARDING_STATE_READ',
          `ONBOARDING_STATE_${onboarding.status.toUpperCase()}`,
          onboardingRequired
            ? 'ONBOARDING_REQUIRED_TRUE'
            : 'ONBOARDING_REQUIRED_FALSE',
          onboardingRequired
            ? 'ONBOARDING_ROUTE_REQUESTED'
            : 'FLOOR_ROUTE_REQUESTED',
          onboardingRequired
            ? 'FINAL_DESTINATION_ONBOARDING'
            : 'FINAL_DESTINATION_FLOOR',
        ]).catch(() => {});
        const currentSite = this._siteManager
          .listSites()
          .find(candidate => candidate.authToken);
        if (
          loadGeneration !== this._onboardingLoadGeneration ||
          onboardingSessionId(currentSite) !== sessionId
        ) {
          return;
        }
        this.setState(
          {
            signedIn: true,
            onboardingReady: true,
            onboardingStatus: onboarding.status,
            onboardingSessionId: sessionId,
            onboardingDismissedForSession: !onboardingRequired,
          },
          this._flushPendingPushRoute,
        );
        return;
      }

      this.setState({ signedIn: true }, this._flushPendingPushRoute);
    };
    this._siteManager.subscribe(this._productSiteSubscription);
    this._productSiteSubscription();
    this._consumeShareIntent();
    this._appStateSubscription = AppState.addEventListener(
      'change',
      this._handleAppStateChange,
    );

    this._handleOpenUrlSubscription = Linking.addEventListener(
      'url',
      this._handleOpenUrl,
    );

    Linking.getInitialURL().then(url => {
      if (url) {
        this._handleOpenUrl({ url: url });
      }
    });

    if (adjusterNetwork.features.push && Platform.OS === 'ios') {
      addShortcutListener(({ userInfo }) => {
        if (userInfo.siteUrl) {
          this._handleOpenUrl({
            url: `adjusternetwork://share?sharedUrl=${userInfo.siteUrl}`,
          });
        }
      });

      this.eventEmitter = new NativeEventEmitter(DiscourseKeyboardShortcuts);
      this.eventEmitter.addListener('keyInputEvent', res => {
        const { input } = res;

        if (input === 'W') {
          this._navigation.navigate('Home');
        } else {
          const index = parseInt(input, 10) - 1;
          const site = this._siteManager.getSiteByIndex(index);

          if (site) {
            this.openUrl(site.url);
          }
        }
      });

      // delay here may be redundant, but it ensures site data is loaded
      setTimeout(this._initBackgroundFetch, 2000);
    }

    clearTimeout(this.refreshTimerId);
    this.refreshTimerId = setTimeout(this._refresh, 30000);
  }

  // runs on background, ever 15 mins max
  // updates site unread counts, app badge
  // and for non-hosted sites, triggers a local notification if new count > old count
  async _initBackgroundFetch() {
    // uncomment to test iOS background
    // this will run on app live reload
    // await this._siteManager.iOSbackgroundRefresh();

    const onEvent = async taskId => {
      console.log('[BackgroundFetch] task: ', taskId);
      await this._siteManager.iOSbackgroundRefresh();

      // You must signal to the OS that your task is complete.
      BackgroundFetch.finish(taskId);
    };

    // Timeout callback is executed when your Task has exceeded its allowed running-time.
    // You must stop what you're doing immediately BackgroundFetch.finish(taskId)
    const onTimeout = async taskId => {
      console.warn('[BackgroundFetch] TIMEOUT task: ', taskId);
      BackgroundFetch.finish(taskId);
    };
    // Initialize BackgroundFetch only once when component mounts.
    let status = await BackgroundFetch.configure(
      { minimumFetchInterval: 15 },
      onEvent,
      onTimeout,
    );
    console.log('[BackgroundFetch] configure status: ', status);
  }

  async _refresh() {
    clearTimeout(this.refreshTimerId);
    if (!this.state.signedIn && !this._siteManager.activeSite) {
      // The native authenticated shell loads bounded collections itself.
      // Preserve the legacy multi-site refresh only while signed out and no
      // site is active, otherwise it can continuously extend rate limits.
      await this._siteManager.refreshSites();
    }
    this.refreshTimerId = setTimeout(this._refresh, 30000);
  }

  async _addSite(url) {
    if (!isCanonicalUrl(url)) {
      Alert.alert(i18n.t('cannot_load_url'));
      return;
    }
    // when adding a site, try stripping off the path
    // helps find the site if users aren't on homepage
    const match = url.match(/^(https?:\/\/[^/]+)\//);

    if (!match) {
      Alert.alert(i18n.t('cannot_load_url'));
    }

    const siteUrl = match[1];

    try {
      const newSite = await Site.fromTerm(siteUrl);

      if (newSite) {
        this._siteManager.add(newSite);
        this._navigation.navigate('Home');
      }
    } catch {
      if (url !== siteUrl) {
        // stripping off path is imperfect, try the full URL
        // this is particularly helpful with subfolder sites
        try {
          const newSite2 = await Site.fromTerm(url);
          if (newSite2) {
            this._siteManager.add(newSite2);
            this._navigation.navigate('Home');
          }
        } catch {
          Alert.alert(i18n.t('cannot_load_url'));
        }
      } else {
        Alert.alert(i18n.t('cannot_load_url'));
      }
    }
  }

  componentWillUnmount() {
    this._siteManager.unsubscribe(this._productSiteSubscription);
    this.eventEmitter?.removeAllListeners('keyInputEvent');
    this._appStateSubscription?.remove();
    this._handleOpenUrlSubscription?.remove();
    this.subscription?.remove();
    clearTimeout(this.safariViewTimeout);
    clearTimeout(this.refreshTimerId);
  }

  openUrl(url) {
    const kind = classifyNavigation(url);
    if (kind === 'external') {
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (kind !== 'internal') {
      return;
    }
    const site = this._siteManager
      .listSites()
      .find(item => item.authToken && isCanonicalUrl(item.url));
    const route = classifyFirstPartyMemberRoute(url, {
      authenticated: Boolean(site),
      isStaff: Boolean(site?.isStaff),
    });
    if (route.disposition === 'native') {
      this._siteManager.setActiveSite(site);
      if (route.screen === 'Ask') {
        this._navigation.navigate('HomeWrapper', { screen: 'Ask' });
      } else {
        this._navigation.navigate(route.screen, route.params);
      }
      return;
    }
    if (route.disposition === 'privileged_external') {
      Linking.openURL(route.url).catch(() => {});
    }
  }

  async connectCanonical() {
    this.setState({ connecting: true });
    try {
      let site = this._siteManager
        .listSites()
        .find(item => isCanonicalUrl(item.url));
      if (!site) {
        site = await Site.fromTerm(adjusterNetwork.canonicalOrigin);
        if (!site) {
          Alert.alert(
            'Unable to connect',
            'Adjuster Network could not be reached. Check your connection and try again.',
          );
          return;
        }
        this._siteManager.add(site);
      }
      this._siteManager.setActiveSite(site);
      const authUrl = await this._siteManager.generateAuthURL(site);
      if (Platform.OS === 'ios') {
        const returnUrl = await this._siteManager.requestAuth(authUrl);
        if (returnUrl) this.openUrl(returnUrl);
      } else {
        this.openUrl(authUrl);
      }
    } catch (error) {
      // iOS can deliver the verified callback through Linking while the
      // presentation promise concurrently reports browser invalidation. Once
      // the callback has established a connected site, that verified state is
      // authoritative and must not be surfaced as a failed login.
      if (await shouldReportAuthFailureAfterSettlement(this._siteManager)) {
        const category = classifyAuthFailure(error);
        securityEvent(`auth.failure.${category}`);
        if (category !== AUTH_FAILURE.USER_CANCEL) {
          const alert = authFailureAlert(category);
          Alert.alert(alert.title, alert.message);
        }
      }
    } finally {
      this.setState({ connecting: false });
    }
  }

  _toggleTheme(newTheme) {
    const preference = ['system', 'light', 'dark'].includes(newTheme)
      ? newTheme
      : 'system';
    const resolved =
      preference === 'system' ? Appearance.getColorScheme() : preference;
    AsyncStorage.setItem('@AdjusterNetwork.themePreference', preference);
    this.setState({
      themePreference: preference,
      theme: resolved === 'dark' ? themes.dark : themes.light,
    });
  }

  _blurView(themeName) {
    const positionStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    };
    if (Platform.OS !== 'ios') {
      return (
        <View
          style={{
            ...positionStyle,
            backgroundColor: this.state.theme.background,
          }}
        />
      );
    }

    return (
      <BlurView blurType={themeName} blurAmount={15} style={positionStyle} />
    );
  }

  render() {
    // TODO: pass only relevant props to each screen component
    const screenProps = {
      openUrl: this.openUrl.bind(this),
      _handleOpenUrl: this._handleOpenUrl,
      seenNotificationMap: this._seenNotificationMap,
      setSeenNotificationMap: map => {
        this._seenNotificationMap = map;
      },
      siteManager: this._siteManager,
      deviceId: this.state.deviceId,
      largerUI: this.state.largerUI,
      toggleTheme: this._toggleTheme.bind(this),
      setThemePreference: this._toggleTheme.bind(this),
      themePreference: this.state.themePreference,
      memberContentVersion: this.state.memberContentVersion,
      invalidateMemberContent: () =>
        this.setState(current => ({
          memberContentVersion: current.memberContentVersion + 1,
        })),
      pushStatus: this.state.pushStatus,
      pushAttemptResult: this.state.pushAttemptResult,
      enablePush: async () => {
        const site = this._siteManager.activeSite || this._siteManager.sites[0];
        if (!site) return;
        const started = startedPushRegistration();
        recordPushRegistrationResult(started);
        this.setState({ pushStatus: 'working', pushAttemptResult: started });
        try {
          const result = await this._pushFoundation.enable(site);
          this.setState({
            pushStatus: result.category || result,
            pushAttemptResult: result,
          });
        } catch (error) {
          const result = resultFromPushError(
            error,
            PUSH_REGISTRATION_STAGE.UNKNOWN,
          );
          this.setState({
            pushStatus: result.category,
            pushAttemptResult: result,
          });
        }
      },
    };

    const theme = this.state.theme;
    const shellColors = productTheme(theme.name);
    const navigationTheme = {
      dark: theme.name === 'dark',
      colors: {
        primary: shellColors.accent,
        background: shellColors.canvas,
        card: shellColors.canvas,
        text: shellColors.text,
        border: shellColors.border,
        notification: shellColors.accent,
      },
    };

    if (!this.state.signedIn) {
      return (
        <SafeAreaProvider
          style={{ flex: 1, backgroundColor: shellColors.canvas }}
        >
          <ThemeContext.Provider value={theme}>
            <StatusBar barStyle={theme.barStyle} translucent={false} />
            <WelcomeScreen
              busy={this.state.connecting}
              onConnect={() => this.connectCanonical()}
              onLogin={() => this.connectCanonical()}
            />
            {this.state.privacyShield && this._blurView(theme.name)}
          </ThemeContext.Provider>
        </SafeAreaProvider>
      );
    }

    if (
      this.state.onboardingReady &&
      this.state.onboardingStatus !== ONBOARDING_STATUS.COMPLETED &&
      !this.state.onboardingDismissedForSession
    ) {
      return (
        <SafeAreaProvider
          style={{ flex: 1, backgroundColor: shellColors.canvas }}
        >
          <ThemeContext.Provider value={theme}>
            <StatusBar barStyle={theme.barStyle} translucent={false} />
            <OnboardingScreen
              sessionId={this.state.onboardingSessionId}
              site={this._siteManager
                .listSites()
                .find(candidate => candidate.authToken)}
              onReconnect={() => {
                const site = this._siteManager
                  .listSites()
                  .find(candidate => candidate.authToken);
                if (site) {
                  this._siteManager.remove(site);
                }
              }}
              onSkip={state =>
                this.setState(
                  {
                    onboardingStatus: state.status,
                    onboardingDismissedForSession: true,
                  },
                  this._flushPendingPushRoute,
                )
              }
              onComplete={state =>
                this.setState(
                  {
                    onboardingStatus: state.status,
                    onboardingDismissedForSession: true,
                  },
                  this._flushPendingPushRoute,
                )
              }
            />
            {this.state.privacyShield && this._blurView(theme.name)}
          </ThemeContext.Provider>
        </SafeAreaProvider>
      );
    }

    return (
      <SafeAreaProvider
        style={{ flex: 1, backgroundColor: shellColors.canvas }}
      >
        <NavigationContainer
          theme={navigationTheme}
          onReady={this._flushPendingPushRoute}
        >
          <ThemeContext.Provider value={theme}>
            <StatusBar barStyle={theme.barStyle} translucent={false} />
            <Stack.Navigator
              initialRouteName="Home"
              presentation="modal"
              screenOptions={({ navigation }) => {
                this._navigation = navigation;
                return {
                  headerShown: false,
                  gestureEnabled: true,
                  ...TransitionPresets.ModalSlideFromBottomIOS,
                  // ...TransitionPresets.ModalPresentationIOS is an interesting alternative
                  // see https://reactnavigation.org/docs/stack-navigator/#transitionpresets
                };
              }}
            >
              <Stack.Screen name="HomeWrapper">
                {() => (
                  <Tab.Navigator
                    screenOptions={{
                      headerShown: false,
                      tabBarHideOnKeyboard: true,

                      tabBarStyle: {
                        position: 'absolute',
                        left: 10,
                        right: 10,
                        bottom: 8,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: shellColors.border,
                        borderRadius: 28,
                        backgroundColor: shellColors.tab,
                        height: this.state.largerUI ? 76 : 70,
                        paddingTop: 7,
                        shadowColor: '#07131D',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: theme.name === 'dark' ? 0.22 : 0.1,
                        shadowRadius: 12,
                        elevation: 6,
                      },
                      tabBarLabelStyle: {
                        fontSize: this.state.largerUI ? 13 : 10,
                        fontWeight: '700',
                        paddingBottom: 3,
                      },
                      // Bottom tabs have fixed-width slots. Letting Dynamic Type
                      // scale six labels makes the destinations overlap and clip;
                      // the tab buttons still expose their full titles to VoiceOver.
                      tabBarAllowFontScaling: false,
                      tabBarActiveTintColor: shellColors.brandAccent,
                      tabBarInactiveTintColor: shellColors.muted,
                      tabBarBackground: () => this._blurView(theme.name),
                    }}
                  >
                    <Tab.Screen
                      name="Home"
                      options={{
                        title: adjusterNetwork.navigation.floor.label,
                        tabBarIcon: ({ color }) => (
                          <FontAwesome5
                            name={'home'}
                            size={18}
                            color={color}
                            iconStyle="solid"
                          />
                        ),
                      }}
                    >
                      {props => (
                        <FloorScreen
                          {...props}
                          screenProps={{ ...screenProps }}
                        />
                      )}
                    </Tab.Screen>
                    <Tab.Screen
                      name={'Discussions'}
                      options={{
                        title: 'Discussions',
                        tabBarIcon: ({ color }) => (
                          <FontAwesome5
                            name={'comments'}
                            size={18}
                            color={color}
                            iconStyle="solid"
                          />
                        ),
                      }}
                    >
                      {props => (
                        <DiscussionsScreen
                          {...props}
                          screenProps={{ ...screenProps }}
                        />
                      )}
                    </Tab.Screen>
                    <Tab.Screen
                      name="Ask"
                      options={{
                        title: 'Ask',
                        tabBarIcon: () => (
                          <View
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 19,
                              transform: [{ translateY: -10 }],
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: shellColors.brandAccent,
                            }}
                          >
                            <FontAwesome5
                              name="plus"
                              size={18}
                              color="#FFFFFF"
                              iconStyle="solid"
                            />
                          </View>
                        ),
                      }}
                    >
                      {props => (
                        <AskScreen
                          {...props}
                          screenProps={{ ...screenProps }}
                        />
                      )}
                    </Tab.Screen>
                    <Tab.Screen
                      name="Lounge"
                      options={{
                        title: 'Lounge',
                        tabBarIcon: ({ color }) => (
                          <FontAwesome5
                            name="comment"
                            size={18}
                            color={color}
                            iconStyle="solid"
                          />
                        ),
                      }}
                    >
                      {props => (
                        <LoungeScreen
                          {...props}
                          screenProps={{ ...screenProps }}
                        />
                      )}
                    </Tab.Screen>
                    <Tab.Screen
                      name="Intelligence"
                      options={{
                        title: 'Intel',
                        tabBarIcon: ({ color }) => (
                          <FontAwesome5
                            name="signal"
                            size={18}
                            color={color}
                            iconStyle="solid"
                          />
                        ),
                      }}
                    >
                      {props => (
                        <IntelligenceScreen
                          {...props}
                          screenProps={{ ...screenProps }}
                        />
                      )}
                    </Tab.Screen>
                    <Tab.Screen
                      name="Profile"
                      options={{
                        title: 'You',
                        tabBarIcon: ({ color }) => (
                          <FontAwesome5
                            name="user"
                            size={18}
                            color={color}
                            iconStyle="solid"
                          />
                        ),
                      }}
                    >
                      {props => (
                        <ProfileScreen
                          {...props}
                          screenProps={{ ...screenProps }}
                        />
                      )}
                    </Tab.Screen>
                  </Tab.Navigator>
                )}
              </Stack.Screen>
              <Stack.Screen
                name={'Settings'}
                options={({ navigation }) => ({
                  title: i18n.t('settings'),
                  headerShown: true,
                  header: () => (
                    <SafeAreaView edges={['top']}>
                      <NestedHeader
                        title={i18n.t('settings')}
                        onBack={() => navigation.goBack()}
                      />
                    </SafeAreaView>
                  ),
                })}
              >
                {props => (
                  <Screens.Settings
                    {...props}
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen
                name={'AddSite'}
                options={({ navigation }) => ({
                  title: i18n.t('add_single_site'),
                  headerShown: true,
                  header: () => (
                    <SafeAreaView edges={['top']}>
                      <NestedHeader
                        title={i18n.t('add_single_site')}
                        onBack={() => navigation.goBack()}
                      />
                    </SafeAreaView>
                  ),
                })}
              >
                {props => (
                  <Screens.AddSite
                    {...props}
                    screenProps={{ ...screenProps }}
                    singleSiteAdd={true}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="WebView">
                {props => (
                  <Screens.WebView
                    {...props}
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Topic">
                {props => (
                  <NativeTopicScreen
                    {...props}
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Collection">
                {props => (
                  <NativeCollectionScreen
                    {...props}
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="MemberProfile">
                {props => (
                  <NativeProfileScreen
                    {...props}
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Account">
                {props => (
                  <AccountScreen {...props} screenProps={{ ...screenProps }} />
                )}
              </Stack.Screen>
              <Stack.Screen name="NotificationSettings">
                {props => (
                  <NotificationSettingsScreen
                    {...props}
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="AppearanceSettings">
                {props => (
                  <AppearanceSettingsScreen
                    {...props}
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="PrivacyAccount">
                {props => (
                  <PrivacyAccountScreen
                    {...props}
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Search">
                {props => (
                  <NativeSearchScreen
                    {...props}
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Bookmarks">
                {props => (
                  <NativeBookmarksScreen
                    {...props}
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen
                name="NotificationCenter"
                options={({ navigation }) => ({
                  headerShown: true,
                  header: () => (
                    <SafeAreaView edges={['top']}>
                      <V2BrandHeader
                        title="Notifications"
                        subtitle="Replies, mentions, and member activity."
                        onBack={() => navigation.goBack()}
                      />
                    </SafeAreaView>
                  ),
                })}
              >
                {props => (
                  <Screens.Notifications
                    {...props}
                    nativeMemberShell
                    screenProps={{ ...screenProps }}
                  />
                )}
              </Stack.Screen>
            </Stack.Navigator>
            {this.state.privacyShield && (
              <View
                accessibilityLabel="Private content hidden"
                accessibilityRole="summary"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: theme.background },
                ]}
              />
            )}
          </ThemeContext.Provider>
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }
}

export default Discourse;
