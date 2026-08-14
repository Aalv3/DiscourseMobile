/* @flow */
'use strict';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

import {
  LEGACY_ONBOARDING_KEY,
  loadOnboardingState,
  markOnboardingCompleted,
  markOnboardingSkipped,
  ONBOARDING_KEY,
  ONBOARDING_STATUS,
  onboardingSessionId,
  shouldShowOnboarding,
} from '../onboardingState';

const memoryStorage = initial => {
  const values = new Map(Object.entries(initial || {}));
  return {
    getItem: jest.fn(key => Promise.resolve(values.get(key) || null)),
    setItem: jest.fn((key, value) => {
      values.set(key, value);
      return Promise.resolve();
    }),
    value: key => values.get(key),
  };
};

describe('persistent onboarding lifecycle', () => {
  test('fresh and corrupt state fail toward not started', async () => {
    expect((await loadOnboardingState(memoryStorage())).status).toBe(
      ONBOARDING_STATUS.NOT_STARTED,
    );
    const corrupt = memoryStorage({ [ONBOARDING_KEY]: '{bad' });
    expect((await loadOnboardingState(corrupt)).status).toBe(
      ONBOARDING_STATUS.NOT_STARTED,
    );
  });

  test('skip dismisses only the current login session', async () => {
    const storage = memoryStorage();
    const skipped = await markOnboardingSkipped('session-a', storage);

    expect(skipped.status).toBe(ONBOARDING_STATUS.INCOMPLETE);
    expect(shouldShowOnboarding(skipped, 'session-a')).toBe(false);
    expect(shouldShowOnboarding(skipped, 'session-b')).toBe(true);
    expect((await loadOnboardingState(storage)).status).toBe(
      ONBOARDING_STATUS.INCOMPLETE,
    );
  });

  test('completion survives later logins and relaunches', async () => {
    const storage = memoryStorage();
    const completed = await markOnboardingCompleted(['Property'], storage);

    expect(shouldShowOnboarding(completed, 'session-a')).toBe(false);
    expect(shouldShowOnboarding(completed, 'session-b')).toBe(false);
    expect(await loadOnboardingState(storage)).toEqual(completed);
  });

  test('known legacy completion migrates and remains completed', async () => {
    const storage = memoryStorage({
      [LEGACY_ONBOARDING_KEY]: JSON.stringify({
        completed: true,
        interests: ['Auto'],
      }),
    });
    const state = await loadOnboardingState(storage);

    expect(state.status).toBe(ONBOARDING_STATUS.COMPLETED);
    expect(JSON.parse(storage.value(ONBOARDING_KEY)).status).toBe(
      ONBOARDING_STATUS.COMPLETED,
    );
  });

  test('known legacy incomplete state reminds', async () => {
    const storage = memoryStorage({
      [LEGACY_ONBOARDING_KEY]: JSON.stringify({ completed: false }),
    });
    const state = await loadOnboardingState(storage);

    expect(state.status).toBe(ONBOARDING_STATUS.INCOMPLETE);
    expect(shouldShowOnboarding(state, 'new-session')).toBe(true);
  });

  test('site creation time identifies one login across relaunch', () => {
    expect(onboardingSessionId({ createdAt: 1234 })).toBe('1234');
    expect(onboardingSessionId({ createdAt: 1234 })).not.toBe(
      onboardingSessionId({ createdAt: 5678 }),
    );
  });
});
