/* @flow */
'use strict';

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const incomplete = {
  state: 'INCOMPLETE',
  completed: false,
  requiredVersion: 2,
  completedVersion: 0,
};
const completed = {
  state: 'COMPLETED',
  completed: true,
  requiredVersion: 2,
  completedVersion: 2,
};
const mockCanonicalReads = jest.fn();
let mockLocalOnboarding;
const mockInvalidateApiCache = jest.fn();
const mockSite = {
  authToken: 'test-token',
  clientId: 'test-client',
  createdAt: 1,
  url: 'https://staging.adjusternetwork.org',
  invalidateApiCache: mockInvalidateApiCache,
  jsonApi: jest.fn(),
};

jest.mock('../product/AdjusterCardOnboardingScreen', () => {
  const ReactModule = require('react');
  return props => ReactModule.createElement('OnboardingScreen', props);
});
jest.mock('@react-native-community/push-notification-ios', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  setApplicationIconBadgeNumber: jest.fn(),
}));
jest.mock('react-native-localize', () => ({
  addEventListener: jest.fn(),
  findBestLanguageTag: jest.fn(() => ({ languageTag: 'en' })),
  findBestAvailableLanguage: jest.fn(() => ({
    languageTag: 'en',
    isRTL: false,
  })),
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));
jest.mock('react-native-screens', () => ({ enableScreens: jest.fn() }));
jest.mock('@react-native-vector-icons/fontawesome5', () => () => null);
jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    NavigationContainer: props =>
      ReactModule.createElement('AuthenticatedNavigator', props),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  return {
    SafeAreaProvider: props =>
      ReactModule.createElement('SafeAreaProvider', props),
    SafeAreaView: props => ReactModule.createElement('SafeAreaView', props),
  };
});
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: () => null,
    Screen: () => null,
  }),
  TransitionPresets: { ModalPresentationIOS: {} },
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: () => null,
    Screen: () => null,
  }),
}));
jest.mock('../site_manager', () =>
  jest.fn().mockImplementation(() => ({
    activeSite: mockSite,
    sites: [mockSite],
    isLoading: () => false,
    listSites: () => [mockSite],
    setPushFoundation: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    refreshNotificationState: jest.fn().mockResolvedValue([]),
  })),
);
jest.mock('../adjusterCardClient', () => {
  const actual = jest.requireActual('../adjusterCardClient');
  return {
    ...actual,
    loadCanonicalOnboarding: (...args) => mockCanonicalReads(...args),
  };
});
jest.mock('../onboardingState', () => {
  const actual = jest.requireActual('../onboardingState');
  return {
    ...actual,
    loadOnboardingState: jest.fn(() => Promise.resolve(mockLocalOnboarding)),
    recordOnboardingAuditTrace: jest.fn().mockResolvedValue(undefined),
  };
});
jest.mock('../pushFoundation', () => ({
  PushFoundation: jest.fn().mockImplementation(() => ({
    diagnosticState: jest.fn(() => ({ state: 'disabled' })),
    status: jest.fn().mockResolvedValue('disabled'),
  })),
}));
jest.mock('../pushBackendClient', () => ({ PushBackendClient: jest.fn() }));
jest.mock('../platforms/push-transport', () => ({ pushTransport: {} }));
jest.mock('../platforms/background-fetch', () => ({
  configure: jest.fn(),
  finish: jest.fn(),
  STATUS_AVAILABLE: 2,
}));
jest.mock('../pushInstallationStore', () => ({ pushInstallationStore: {} }));
jest.mock('../product/ProductScreens', () => ({
  AskScreen: () => null,
  DiscussionsScreen: () => null,
  FloorScreen: () => null,
  IntelligenceScreen: () => null,
  LoungeScreen: () => null,
  ProfileScreen: () => null,
  WelcomeScreen: () => null,
}));
jest.mock('../product/NativeMemberUtilityScreens', () => ({
  AccountScreen: () => null,
  AppearanceSettingsScreen: () => null,
  NativeBookmarksScreen: () => null,
  NativeSearchScreen: () => null,
  NotificationSettingsScreen: () => null,
  PrivacyAccountScreen: () => null,
}));
jest.mock('../product/NativeTopicScreen', () => () => null);
jest.mock('../product/NativeCollectionScreen', () => () => null);
jest.mock('../product/NativeProfileScreen', () => () => null);
jest.mock('../screens', () => ({ Notifications: () => null }));
jest.mock('react-native-device-info', () => ({
  getDeviceId: () => 'test-device',
  getDeviceType: () => 'Handset',
  getVersion: () => '1.0',
  getBuildNumber: () => '1',
}));
jest.mock('react-native-safari-view', () => ({}));
jest.mock('react-native-siri-shortcut', () => ({
  addShortcutListener: jest.fn(),
}));
jest.mock('@react-native-community/blur', () => ({ BlurView: () => null }));

import Discourse from '../Discourse';
import { saveOnboardingProgress } from '../adjusterCardClient';

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('mounted post-Finish onboarding transition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanonicalReads.mockResolvedValue(incomplete);
    mockLocalOnboarding = {
      status: 'incomplete',
      dismissedSessionId: null,
      completedAt: null,
      schemaVersion: 3,
    };
  });

  test('invalidates stale onboarding and mounts the authenticated navigator only after canonical completion', async () => {
    let tree;
    await act(async () => {
      tree = TestRenderer.create(<Discourse />);
      await flush();
      await flush();
    });
    // The mounted root must expose the real onboarding completion callback.
    const onboardingNodes = tree.root.findAllByType('OnboardingScreen');
    if (!onboardingNodes.length) {
      throw new Error(
        `missing_onboarding:${JSON.stringify(
          tree.root.findByType(Discourse).instance.state,
        )}`,
      );
    }
    const onboarding = onboardingNodes[0];

    mockSite.jsonApi.mockResolvedValue({
      schema: 'an.onboarding-progress.v2',
      schema_version: 2,
      state: 'COMPLETED',
      step: 4,
      completed: true,
      deferred: false,
      required_onboarding_version: 2,
      completed_onboarding_version: 2,
      policy: { schema: 'an.policy-instruments.v1' },
    });
    await saveOnboardingProgress(mockSite, { onboarding_action: 'finish' });
    expect(mockInvalidateApiCache).toHaveBeenCalledWith([
      '/native/v1/onboarding',
    ]);

    mockCanonicalReads.mockResolvedValue(completed);
    mockLocalOnboarding = {
      status: 'completed',
      dismissedSessionId: null,
      completedAt: '2026-08-29T02:28:04.719Z',
      schemaVersion: 3,
    };
    await act(async () => {
      onboarding.props.onComplete({ status: 'completed' });
      await flush();
    });

    expect(mockCanonicalReads).toHaveBeenLastCalledWith(mockSite);
    expect(tree.root.findByType('AuthenticatedNavigator')).toBeTruthy();
    expect(tree.root.findAllByType('OnboardingScreen')).toHaveLength(0);
    await act(async () => {
      tree.unmount();
    });
  });

  test('retains completed local context and renders a bounded retry state when verification fails', async () => {
    let tree;
    await act(async () => {
      tree = TestRenderer.create(<Discourse />);
      await flush();
      await flush();
    });
    const onboarding = tree.root.findByType('OnboardingScreen');
    mockLocalOnboarding = {
      status: 'completed',
      dismissedSessionId: null,
      completedAt: '2026-08-29T02:28:04.719Z',
      schemaVersion: 3,
    };
    mockCanonicalReads.mockRejectedValue(new Error('offline'));

    await act(async () => {
      onboarding.props.onComplete({ status: 'completed' });
      await flush();
    });

    const instance = tree.root.findByType(Discourse).instance;
    expect(instance.state.onboardingReady).toBe(false);
    expect(instance.state.onboardingStatus).toBe('completed');
    expect(instance.state.onboardingVerificationError).toContain(
      'completed setup could not be verified',
    );
    expect(tree.root.findAllByType('AuthenticatedNavigator')).toHaveLength(0);
    expect(
      tree.root.findAll(
        node =>
          node.props?.accessibilityRole === 'button' &&
          node.children.includes('Try again'),
      ),
    ).toHaveLength(1);
    await act(async () => {
      tree.unmount();
    });
  });
});
