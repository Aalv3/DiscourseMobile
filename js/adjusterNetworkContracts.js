/* @flow */
'use strict';

const INTELLIGENCE_SCHEMA = 'an.home-intelligence.v1';
const INTELLIGENCE_STATES = new Set([
  'ready',
  'empty',
  'stale',
  'degraded',
  'error',
]);

// This is a client integration boundary, not a second implementation of
// server policy. The server remains authoritative for identity, permissions,
// visibility, admission, and content mutation.
export const nativeContracts = Object.freeze({
  destinations: Object.freeze({
    floor: Object.freeze({ route: 'Home', contract: 'discourse.web.v1' }),
    activity: Object.freeze({
      route: 'Notifications',
      contract: 'discourse.notifications.v1',
    }),
    ask: Object.freeze({ route: null, contract: null, status: 'blocked' }),
    cat: Object.freeze({
      route: null,
      contract: INTELLIGENCE_SCHEMA,
      status: 'contract_only',
    }),
    you: Object.freeze({ route: null, contract: null, status: 'blocked' }),
  }),
  todayBrief: Object.freeze({
    endpoint: '/renaissance/intelligence',
    method: 'GET',
    authentication: 'required',
    schema: INTELLIGENCE_SCHEMA,
    sections: Object.freeze([
      'claims_and_regulatory',
      'claims_weather',
      'network',
    ]),
  }),
  authentication: Object.freeze({
    protocol: 'discourse_user_api_key_v2',
    approvalSurface: 'system_browser',
    callback: 'adjusternetwork://auth_redirect',
    tokenStorage: 'async_storage',
    serverAuthoritative: true,
  }),
  deepLinks: Object.freeze({
    canonicalOrigin: 'https://adjusternetwork.org',
    notificationRoute: 'adjusternetwork://open',
    appLinks: Object.freeze([
      'https://adjusternetwork.org/t/*',
      'https://adjusternetwork.org/c/*',
      'https://adjusternetwork.org/u/*',
    ]),
  }),
  appearance: Object.freeze({
    default: 'light',
    modes: Object.freeze(['system', 'light', 'dark']),
  }),
  adjusterCard: Object.freeze({
    profile: Object.freeze({
      schema: 'an.adjuster-card.v2',
      endpoint: '/native/v1/profile',
      capabilityDriven: true,
    }),
    onboarding: Object.freeze({
      schema: 'an.onboarding-progress.v2',
      endpoint: '/native/v1/onboarding',
      serverAuthoritative: true,
    }),
    resume: Object.freeze({
      schema: 'an.private-resume.v1',
      endpoint: '/native/v1/profile/resume',
      ownerOnly: true,
      publicUrl: false,
      recruiterSearch: false,
    }),
  }),
  restrictions: Object.freeze({
    authority: 'server',
    failClosed: true,
    capabilities: Object.freeze({
      registration: 'closed',
      uploads: 'server_authorized_only',
      memberMessages: 'server_authorized_only',
      moderation: 'server_authorized_only',
    }),
  }),
  future: Object.freeze({
    requestToJoin: Object.freeze({ route: null, status: 'counsel_gated' }),
  }),
});

export function parseHomepageIntelligence(payload: mixed) {
  if (
    payload == null ||
    typeof payload !== 'object' ||
    payload.schema !== INTELLIGENCE_SCHEMA ||
    !INTELLIGENCE_STATES.has(payload.state) ||
    typeof payload.generated_at !== 'string'
  ) {
    return Object.freeze({ state: 'unavailable', reason: 'contract_mismatch' });
  }

  for (const section of nativeContracts.todayBrief.sections) {
    if (payload[section] == null || typeof payload[section] !== 'object') {
      return Object.freeze({ state: 'unavailable', reason: 'missing_section' });
    }
  }

  return payload;
}
