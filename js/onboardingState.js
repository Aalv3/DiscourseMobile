/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_KEY = '@AdjusterNetwork.onboarding.v2';
export const LEGACY_ONBOARDING_KEY = '@AdjusterNetwork.onboarding.v1';
export const ONBOARDING_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  INCOMPLETE: 'incomplete',
  COMPLETED: 'completed',
});

function parseState(value) {
  if (!value) return null;
  try {
    const state = JSON.parse(value);
    if (!Object.values(ONBOARDING_STATUS).includes(state?.status)) return null;
    return {
      status: state.status,
      interests: Array.isArray(state.interests) ? state.interests : [],
      dismissedSessionId:
        typeof state.dismissedSessionId === 'string'
          ? state.dismissedSessionId
          : null,
    };
  } catch {
    return null;
  }
}

export async function loadOnboardingState(storage = AsyncStorage) {
  const current = parseState(await storage.getItem(ONBOARDING_KEY));
  if (current) return current;

  const legacyValue = await storage.getItem(LEGACY_ONBOARDING_KEY);
  try {
    const legacy = legacyValue ? JSON.parse(legacyValue) : null;
    if (legacy?.completed === true) {
      const migrated = {
        status: ONBOARDING_STATUS.COMPLETED,
        interests: Array.isArray(legacy.interests) ? legacy.interests : [],
        dismissedSessionId: null,
      };
      await storage.setItem(ONBOARDING_KEY, JSON.stringify(migrated));
      return migrated;
    }
    if (legacy) {
      return {
        status: ONBOARDING_STATUS.INCOMPLETE,
        interests: Array.isArray(legacy.interests) ? legacy.interests : [],
        dismissedSessionId: null,
      };
    }
  } catch {
    // Missing or corrupt state must never be interpreted as completion.
  }
  return { status: ONBOARDING_STATUS.NOT_STARTED };
}

export const onboardingSessionId = site =>
  site?.createdAt ? String(site.createdAt) : 'legacy-existing-session';

export function shouldShowOnboarding(state, sessionId) {
  if (state?.status === ONBOARDING_STATUS.COMPLETED) return false;
  if (state?.status !== ONBOARDING_STATUS.INCOMPLETE) return true;
  return state.dismissedSessionId !== sessionId;
}

export async function markOnboardingSkipped(sessionId, storage = AsyncStorage) {
  const state = {
    status: ONBOARDING_STATUS.INCOMPLETE,
    interests: [],
    dismissedSessionId: sessionId,
  };
  await storage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  return state;
}

export async function markOnboardingCompleted(
  interests,
  storage = AsyncStorage,
) {
  const state = {
    status: ONBOARDING_STATUS.COMPLETED,
    interests: Array.isArray(interests) ? interests : [],
    dismissedSessionId: null,
  };
  await storage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  return state;
}
