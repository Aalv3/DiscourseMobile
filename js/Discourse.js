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
import {
  createStackNavigator,
  TransitionPresets,
} from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import Screens from './screens';
import Site from './site';
import SiteManager from './site_manager';
import SafariView from 'react-native-safari-view';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomTabs } from 'react-native-custom-tabs';
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

import BackgroundFetch from './platforms/background-fetch';
import {
  shouldOpenCallbackOneTimePassword,
  shouldReportAuthFailure,
} from './authAttempt';
import {
  AskScreen,
  DiscussionsScreen,
  FloorScreen,
  IntelligenceScreen,
  LoungeScreen,
  OnboardingScreen,
  ProfileScreen,
  WelcomeScreen,
  onboardingComplete,
} from './product/ProductScreens';

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

  constructor(props) {
    super(props);
    this._siteManager = new SiteManager();
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

        clearTimeout(this.refreshTimerId);
        this.refreshTimerId = setTimeout(this._refresh, 30000);
      }
    };

    this._handleOpenUrl = this._handleOpenUrl.bind(this);

    if (adjusterNetwork.features.push && Platform.OS === 'ios') {
      PushNotificationIOS.addEventListener('notification', e =>
        this._handleNotification(e),
      );

      // local notifications, triggered via background fetch
      // for non-hosted sites only (sites where hasPush = false)
      PushNotificationIOS.addEventListener('localNotification', e =>
        this._handleNotification(e),
      );

      PushNotificationIOS.addEventListener('register', s => {
        this._siteManager.registerClientId(s);
      });

      PushNotificationIOS.getInitialNotification().then(e => {
        if (e) {
          this._handleNotification(e);
        }
      });
    }

    const colorScheme = Appearance.getColorScheme();
    const largerUI =
      DeviceInfo.getDeviceType() === 'Tablet' ||
      DeviceInfo.getDeviceType() === 'Desktop';

    this.state = {
      deviceId: DeviceInfo.getDeviceId(),
      largerUI: largerUI,
      theme: colorScheme === 'dark' ? themes.dark : themes.light,
      privacyShield: false,
      signedIn: false,
      onboardingReady: false,
      onboardingDone: false,
      connecting: false,
    };

    this.subscription = Appearance.addChangeListener(() => {
      const newColorScheme = Appearance.getColorScheme();
      this.setState({
        theme: newColorScheme === 'dark' ? themes.dark : themes.light,
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
    const url = e._data && e._data.discourse_url;

    if (url) {
      this._siteManager.setActiveSite(url);
      this.openUrl(url);
    }
  }

  async _handleOpenUrl(event) {
    const kind = classifyNavigation(event && event.url);
    if (kind === 'callback') {
      const params = this._siteManager.parseURLparameters(event.url);
      const site = this._siteManager.activeSite;

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

      // handle shared URLs
      if (params.sharedUrl) {
        this._siteManager.setActiveSite(params.sharedUrl).then(activeSite => {
          if (activeSite.activeSite !== undefined) {
            this.openUrl(params.sharedUrl);
          } else {
            this._addSite(params.sharedUrl);
          }
        });
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

  componentDidMount() {
    this._productSiteSubscription = () => {
      this.setState({
        signedIn: this._siteManager.connectedSitesCount() > 0,
      });
    };
    this._siteManager.subscribe(this._productSiteSubscription);
    this._productSiteSubscription();
    onboardingComplete().then(done =>
      this.setState({ onboardingReady: true, onboardingDone: done }),
    );
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
      PushNotificationIOS.requestPermissions({
        alert: true,
        badge: true,
        sound: true,
      });

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
    if (!this._siteManager.activeSite) {
      // don't run background refresh while user is on a site
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
    if (Platform.OS === 'ios') {
      this._navigation.navigate('WebView', {
        url: url,
      });
    }

    if (Platform.OS === 'android') {
      AsyncStorage.getItem('@Discourse.androidCustomTabs').then(value => {
        if (value === 'true') {
          CustomTabs.openURL(url, {
            enableUrlBarHiding: true,
            showPageTitle: false,
          }).catch(() => {});
        } else {
          Linking.openURL(url);
        }
      });
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
    } catch {
      // iOS can deliver the verified callback through Linking while the
      // presentation promise concurrently reports browser invalidation. Once
      // the callback has established a connected site, that verified state is
      // authoritative and must not be surfaced as a failed login.
      if (shouldReportAuthFailure(this._siteManager.connectedSitesCount())) {
        Alert.alert('Unable to connect', 'Please try again in a moment.');
      }
    } finally {
      this.setState({ connecting: false });
    }
  }

  _toggleTheme(newTheme) {
    this.setState({
      theme: newTheme === 'dark' ? themes.dark : themes.light,
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
    };

    const theme = this.state.theme;

    if (!this.state.signedIn) {
      return (
        <ThemeContext.Provider value={theme}>
          <StatusBar barStyle={theme.barStyle} />
          <WelcomeScreen
            busy={this.state.connecting}
            onConnect={() => this.connectCanonical()}
            onLogin={() => this.connectCanonical()}
          />
          {this.state.privacyShield && this._blurView(theme.name)}
        </ThemeContext.Provider>
      );
    }

    if (this.state.onboardingReady && !this.state.onboardingDone) {
      return (
        <ThemeContext.Provider value={theme}>
          <StatusBar barStyle={theme.barStyle} />
          <OnboardingScreen
            onFinish={() => this.setState({ onboardingDone: true })}
          />
          {this.state.privacyShield && this._blurView(theme.name)}
        </ThemeContext.Provider>
      );
    }

    return (
      <NavigationContainer>
        <ThemeContext.Provider value={theme}>
          <StatusBar barStyle={theme.barStyle} />
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

                    tabBarStyle: {
                      position: 'absolute',
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.grayBorder,
                    },
                    tabBarLabelStyle: {
                      fontSize: this.state.largerUI ? 16 : 12,
                    },
                    tabBarActiveTintColor: theme.blueCallToAction,
                    tabBarInactiveTintColor: theme.grayTabInactiveColor,
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
                    name="Ask"
                    options={{
                      title: 'Ask',
                      tabBarIcon: ({ color }) => (
                        <FontAwesome5
                          name="plus-circle"
                          size={20}
                          color={color}
                          iconStyle="solid"
                        />
                      ),
                    }}
                  >
                    {props => (
                      <AskScreen {...props} screenProps={{ ...screenProps }} />
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
              options={{
                title: i18n.t('settings'),
                headerShown: true,
                headerStyle: {
                  backgroundColor: theme.background,
                },
                headerTitleStyle: {
                  color: theme.grayTitle,
                },
                headerTintColor: theme.grayUI,
                headerMode: 'screen',
                headerBackTitle: i18n.t('back'),
                headerShadowVisible: false,
              }}
            >
              {props => (
                <Screens.Settings {...props} screenProps={{ ...screenProps }} />
              )}
            </Stack.Screen>
            <Stack.Screen
              name={'AddSite'}
              options={{
                title: i18n.t('add_single_site'),
                headerShown: true,
                headerStyle: {
                  backgroundColor: theme.background,
                },
                headerTintColor: theme.grayUI,
                headerTitleStyle: {
                  color: theme.grayTitle,
                },
                headerMode: 'screen',
                headerBackTitle: i18n.t('back'),
                headerShadowVisible: false,
              }}
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
                <Screens.WebView {...props} screenProps={{ ...screenProps }} />
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
    );
  }
}

export default Discourse;
