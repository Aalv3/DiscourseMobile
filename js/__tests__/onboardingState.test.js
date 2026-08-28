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
  ONBOARDING_AUDIT_KEY,
  ONBOARDING_STATUS,
  onboardingSessionId,
  recordOnboardingAuditTrace,
  shouldShowOnboarding,
  V2_ONBOARDING_KEY,
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

  test('canonical incomplete state overrides matching historical dismissal', async () => {
    const storage = memoryStorage();
    const skipped = await markOnboardingSkipped('session-a', storage);

    expect(skipped.status).toBe(ONBOARDING_STATUS.INCOMPLETE);
    expect(skipped.completedAt).toBeNull();
    expect(shouldShowOnboarding(skipped, 'session-a')).toBe(true);
    expect(shouldShowOnboarding(skipped, 'session-b')).toBe(true);
    expect((await loadOnboardingState(storage)).status).toBe(
      ONBOARDING_STATUS.INCOMPLETE,
    );
  });

  test('completion survives later logins and relaunches', async () => {
    const storage = memoryStorage();
    const completed = await markOnboardingCompleted(['Property'], storage);

    expect(completed.schemaVersion).toBe(3);
    expect(completed.completedAt).toEqual(expect.any(String));
    expect(shouldShowOnboarding(completed, 'session-a')).toBe(false);
    expect(shouldShowOnboarding(completed, 'session-b')).toBe(false);
    expect(await loadOnboardingState(storage)).toEqual(completed);
  });

  test('contaminated legacy completion migrates toward incomplete', async () => {
    const storage = memoryStorage({
      [LEGACY_ONBOARDING_KEY]: JSON.stringify({
        completed: true,
        interests: ['Auto'],
      }),
    });
    const state = await loadOnboardingState(storage);

    expect(state.status).toBe(ONBOARDING_STATUS.INCOMPLETE);
    expect(JSON.parse(storage.value(ONBOARDING_KEY)).status).toBe(
      ONBOARDING_STATUS.INCOMPLETE,
    );
    expect(shouldShowOnboarding(state, 'new-session')).toBe(true);
  });

  test('v2 completion without final-action evidence migrates incomplete', async () => {
    const storage = memoryStorage({
      [V2_ONBOARDING_KEY]: JSON.stringify({
        status: ONBOARDING_STATUS.COMPLETED,
        interests: [],
        dismissedSessionId: null,
      }),
    });
    const state = await loadOnboardingState(storage);

    expect(state.status).toBe(ONBOARDING_STATUS.INCOMPLETE);
    expect(state.completedAt).toBeNull();
    expect(shouldShowOnboarding(state, 'new-session')).toBe(true);
  });

  test('migration cannot suppress onboarding in the restored session', async () => {
    const storage = memoryStorage({
      [V2_ONBOARDING_KEY]: JSON.stringify({
        status: ONBOARDING_STATUS.COMPLETED,
        interests: [],
      }),
    });
    const state = await loadOnboardingState(storage, 'restored-session');

    expect(shouldShowOnboarding(state, 'restored-session')).toBe(true);
    expect(shouldShowOnboarding(state, 'next-login')).toBe(true);
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

  test('skip remains incomplete until actual completion', async () => {
    const storage = memoryStorage();
    const firstLogin = await loadOnboardingState(storage);
    expect(shouldShowOnboarding(firstLogin, 'login-1')).toBe(true);

    const firstSkip = await markOnboardingSkipped('login-1', storage);
    expect(shouldShowOnboarding(firstSkip, 'login-1')).toBe(true);
    expect(
      shouldShowOnboarding(await loadOnboardingState(storage), 'login-1'),
    ).toBe(true);
    expect(
      shouldShowOnboarding(await loadOnboardingState(storage), 'login-2'),
    ).toBe(true);

    const secondSkip = await markOnboardingSkipped('login-2', storage);
    expect(shouldShowOnboarding(secondSkip, 'login-2')).toBe(true);
    expect(
      shouldShowOnboarding(await loadOnboardingState(storage), 'login-3'),
    ).toBe(true);

    const completed = await markOnboardingCompleted([], storage);
    expect(shouldShowOnboarding(completed, 'login-3')).toBe(false);
    expect(
      shouldShowOnboarding(await loadOnboardingState(storage), 'login-4'),
    ).toBe(false);
  });

  test('audit trace stores fixed safe lifecycle markers only', async () => {
    const storage = memoryStorage();
    await recordOnboardingAuditTrace(
      ['AUTH_COMPLETE', 'ONBOARDING_STATE_INCOMPLETE', 'raw-secret=value'],
      storage,
    );
    expect(JSON.parse(storage.value(ONBOARDING_AUDIT_KEY))).toEqual([
      'AUTH_COMPLETE',
      'ONBOARDING_STATE_INCOMPLETE',
    ]);
  });
});
