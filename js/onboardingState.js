/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_KEY = '@AdjusterNetwork.onboarding.v3';
export const V2_ONBOARDING_KEY = '@AdjusterNetwork.onboarding.v2';
export const LEGACY_ONBOARDING_KEY = '@AdjusterNetwork.onboarding.v1';
export const ONBOARDING_AUDIT_KEY = '@AdjusterNetwork.onboarding.audit.v1';
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
      completedAt:
        typeof state.completedAt === 'string' ? state.completedAt : null,
      schemaVersion: state.schemaVersion === 3 ? 3 : null,
    };
  } catch {
    return null;
  }
}

export async function loadOnboardingState(
  storage = AsyncStorage,
  currentSessionId = null,
) {
  const current = parseState(await storage.getItem(ONBOARDING_KEY));
  if (current) {
    // COMPLETED is valid only when produced by the v3 final action. Older
    // schemas allowed Skip to write the same boolean as true completion.
    if (
      current.status === ONBOARDING_STATUS.COMPLETED &&
      (current.schemaVersion !== 3 || !current.completedAt)
    ) {
      return migrateIncomplete(storage, current.interests, currentSessionId);
    }
    return current;
  }

  const v2 = parseState(await storage.getItem(V2_ONBOARDING_KEY));
  if (v2) {
    // v2 completion was migrated from a historically contaminated v1 flag and
    // has no proof that the final completion action was used.
    return migrateIncomplete(storage, v2.interests, currentSessionId);
  }

  const legacyValue = await storage.getItem(LEGACY_ONBOARDING_KEY);
  try {
    const legacy = legacyValue ? JSON.parse(legacyValue) : null;
    if (legacy) {
      return migrateIncomplete(storage, legacy.interests, currentSessionId);
    }
  } catch {
    // Missing or corrupt state must never be interpreted as completion.
  }
  return { status: ONBOARDING_STATUS.NOT_STARTED };
}

async function migrateIncomplete(
  storage,
  interests = [],
  dismissedSessionId = null,
) {
  const migrated = {
    status: ONBOARDING_STATUS.INCOMPLETE,
    interests: Array.isArray(interests) ? interests : [],
    dismissedSessionId,
    completedAt: null,
    schemaVersion: 3,
  };
  await storage.setItem(ONBOARDING_KEY, JSON.stringify(migrated));
  return migrated;
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
    completedAt: null,
    schemaVersion: 3,
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
    completedAt: new Date().toISOString(),
    schemaVersion: 3,
  };
  await storage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  return state;
}

const AUDIT_STAGES = new Set([
  'AUTH_COMPLETE',
  'ONBOARDING_STATE_READ',
  'ONBOARDING_STATE_NOT_STARTED',
  'ONBOARDING_STATE_INCOMPLETE',
  'ONBOARDING_STATE_COMPLETED',
  'ONBOARDING_REQUIRED_TRUE',
  'ONBOARDING_REQUIRED_FALSE',
  'ONBOARDING_ROUTE_REQUESTED',
  'FLOOR_ROUTE_REQUESTED',
  'FINAL_DESTINATION_ONBOARDING',
  'FINAL_DESTINATION_FLOOR',
]);

export async function recordOnboardingAuditTrace(
  stages,
  storage = AsyncStorage,
) {
  const safeStages = Array.isArray(stages)
    ? stages.filter(stage => AUDIT_STAGES.has(stage))
    : [];
  if (!safeStages.length) return;
  let previous = [];
  try {
    const stored = JSON.parse(
      (await storage.getItem(ONBOARDING_AUDIT_KEY)) || '[]',
    );
    if (Array.isArray(stored)) previous = stored;
  } catch {
    previous = [];
  }
  await storage.setItem(
    ONBOARDING_AUDIT_KEY,
    JSON.stringify([...previous, ...safeStages].slice(-30)),
  );
}
