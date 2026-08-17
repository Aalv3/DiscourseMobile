import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';

jest.mock('@react-native-vector-icons/fontawesome5', () => 'FontAwesome5');
jest.mock('expo-asset', () => ({ useAssets: () => [[], null] }));

import { ThemeContext, themes } from '../ThemeContext';
import NotificationEducation from '../product/NotificationEducation';
import {
  completedPushRegistration,
  PUSH_REGISTRATION_CATEGORY,
  PUSH_REGISTRATION_STAGE,
  pushRegistrationResult,
  startedPushRegistration,
} from '../pushRegistrationResult';

function renderStatus(status, attemptResult, onEnable = jest.fn()) {
  let renderer;
  act(() => {
    renderer = TestRenderer.create(
      <ThemeContext.Provider value={themes.light}>
        <NotificationEducation
          status={status}
          attemptResult={attemptResult}
          onEnable={onEnable}
        />
      </ThemeContext.Provider>,
    );
  });
  return renderer;
}

function renderedText(renderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(value => typeof value === 'string')
    .join(' ');
}

describe('mounted notification retry feedback', () => {
  test('manual retry starts and invokes the supplied action', () => {
    const onEnable = jest.fn();
    const renderer = renderStatus(
      'working',
      startedPushRegistration(),
      onEnable,
    );
    expect(renderedText(renderer)).toContain('Trying notification setup');
    const button = renderer.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityRole === 'button');
    expect(button).toBeUndefined();
  });

  test('manual retry failure is distinct from the idle message and announced', () => {
    const result = pushRegistrationResult({
      stage: PUSH_REGISTRATION_STAGE.BACKEND_TRANSPORT,
      category: PUSH_REGISTRATION_CATEGORY.NETWORK_FAILURE,
    });
    const renderer = renderStatus(result.category, result);
    expect(renderedText(renderer)).toContain('Try again did not complete');
    expect(
      renderer.root.findByProps({ accessibilityRole: 'alert' }),
    ).toBeTruthy();
  });

  test('manual retry success is visible and non-error', () => {
    const result = completedPushRegistration();
    const renderer = renderStatus(result.category, result);
    expect(renderedText(renderer)).toContain('Notifications are now enabled');
    expect(
      renderer.root.findByProps({ accessibilityRole: 'status' }),
    ).toBeTruthy();
  });
});
