/* @flow */
'use strict';

export const ADJUSTER_CARD_SCHEMA = 'an.adjuster-card.v2';
export const ONBOARDING_PROGRESS_SCHEMA = 'an.onboarding-progress.v2';
export const PRIVATE_RESUME_SCHEMA = 'an.private-resume.v1';

export const PROFILE_STEPS = Object.freeze([
  Object.freeze({ id: 'profile', title: 'Profile' }),
  Object.freeze({ id: 'licenses', title: 'Licenses' }),
  Object.freeze({ id: 'experience', title: 'Experience' }),
  Object.freeze({ id: 'resume', title: 'Resume' }),
  Object.freeze({ id: 'preview', title: 'Preview' }),
]);

export const FIELD_GROUPS = Object.freeze({
  profile: Object.freeze([
    'name',
    'professional_headline',
    'bio',
    'base_state',
  ]),
  licenses: Object.freeze(['licensed_states']),
  experience: Object.freeze([
    'adjuster_type',
    'years_experience',
    'specialties',
    'cat_experience',
    'work_mode',
  ]),
});

export const FIELD_OPTIONS = Object.freeze({
  adjuster_type: Object.freeze([
    ['independent', 'Independent adjuster'],
    ['staff', 'Staff adjuster'],
    ['public', 'Public adjuster'],
    ['other', 'Other'],
  ]),
  years_experience: Object.freeze([
    ['under_1', 'Less than 1 year'],
    ['1_to_3', '1–3 years'],
    ['4_to_7', '4–7 years'],
    ['8_to_15', '8–15 years'],
    ['16_plus', '16+ years'],
  ]),
  cat_experience: Object.freeze([
    ['not_stated', 'Prefer not to say'],
    ['none', 'No CAT experience'],
    ['limited', 'Some CAT experience'],
    ['experienced', 'Experienced'],
  ]),
  cat_availability: Object.freeze([
    ['not_stated', 'Prefer not to say'],
    ['unavailable', 'Not available'],
    ['available', 'Available'],
  ]),
  work_mode: Object.freeze([
    ['not_stated', 'Prefer not to say'],
    ['field', 'Field'],
    ['desk', 'Desk'],
    ['either', 'Field or desk'],
  ]),
  travel_preference: Object.freeze([
    ['not_stated', 'Prefer not to say'],
    ['local', 'Local'],
    ['regional', 'Regional'],
    ['nationwide', 'Nationwide'],
  ]),
});

const EMPTY_RESUME = Object.freeze({ state: 'absent', public_url: false });
const VALID_PROGRESS_STATES = new Set([
  'NOT_STARTED',
  'INCOMPLETE',
  'COMPLETED',
]);
const ENUM_FIELDS = new Set([
  'adjuster_type',
  'years_experience',
  'cat_experience',
  'cat_availability',
  'work_mode',
  'travel_preference',
]);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function capabilityFor(payload, field) {
  const capability = payload?.capabilities?.fields?.[field];
  return isObject(capability)
    ? {
        enabled: capability.enabled === true,
        readable: capability.readable === true,
        editable: capability.editable === true,
        visibilityOptions: Array.isArray(capability.visibility_options)
          ? capability.visibility_options.filter(value =>
              ['self', 'members', 'staff'].includes(value),
            )
          : [],
      }
    : {
        enabled: false,
        readable: false,
        editable: false,
        visibilityOptions: [],
      };
}

export function parseAdjusterCard(payload) {
  if (
    !isObject(payload) ||
    payload.schema !== ADJUSTER_CARD_SCHEMA ||
    payload.schema_version !== 2 ||
    !isObject(payload.capabilities)
  ) {
    throw new Error('adjuster_card_contract_mismatch');
  }

  const fieldNames = new Set([
    'name',
    'bio',
    ...(Array.isArray(payload.enabled_fields) ? payload.enabled_fields : []),
    ...Object.keys(payload.fields || {}),
    ...Object.keys(payload.capabilities.fields || {}),
  ]);
  const capabilities = {};
  const memberReadContract = !isObject(payload.capabilities.fields);
  fieldNames.forEach(field => {
    const explicit = capabilityFor(payload, field);
    capabilities[field] =
      memberReadContract &&
      Object.prototype.hasOwnProperty.call(payload.fields || {}, field)
        ? {
            enabled: true,
            readable: true,
            editable: false,
            visibilityOptions: [],
          }
        : explicit;
  });

  const values = {
    name: String(payload.core?.name || ''),
    bio: String(payload.core?.bio || ''),
  };
  Object.entries(payload.fields || {}).forEach(([field, value]) => {
    if (capabilities[field]?.readable) values[field] = value;
  });

  const resumeCapabilities = payload.capabilities.resume;
  const resume =
    isObject(resumeCapabilities) &&
    resumeCapabilities.schema === PRIVATE_RESUME_SCHEMA
      ? {
          ...resumeCapabilities,
          enabled: resumeCapabilities.enabled === true,
          upload: resumeCapabilities.upload === true,
          read: resumeCapabilities.read === true,
          replace: resumeCapabilities.replace === true,
          delete: resumeCapabilities.delete === true,
          owner_only: resumeCapabilities.owner_only === true,
          public_url: false,
          recruiter_access: false,
          search_indexed: false,
        }
      : {
          schema: PRIVATE_RESUME_SCHEMA,
          enabled: false,
          upload: false,
          read: false,
          replace: false,
          delete: false,
          owner_only: true,
          public_url: false,
          recruiter_access: false,
          search_indexed: false,
        };

  return {
    schema: ADJUSTER_CARD_SCHEMA,
    enabled: payload.enabled === true,
    enabledFields: Array.isArray(payload.enabled_fields)
      ? payload.enabled_fields.filter(field => capabilities[field]?.enabled)
      : [],
    values,
    avatarTemplate: String(payload.core?.avatar_template || ''),
    visibility: isObject(payload.visibility) ? payload.visibility : {},
    capabilities,
    photo: {
      enabled: payload.capabilities.photo?.enabled === true,
      editable: payload.capabilities.photo?.editable === true,
      delegatedTo: payload.capabilities.photo?.delegated_to || null,
      publicUrl: false,
    },
    resume,
    resumeMetadata: isObject(payload.resume) ? payload.resume : EMPTY_RESUME,
    recruiterSearchEnabled:
      payload.capabilities.recruiter_search?.enabled === true,
    lockVersion: Number(payload.lock_version || 0),
    editable: payload.editable === true,
  };
}

export function parseOnboardingProgress(payload) {
  if (
    !isObject(payload) ||
    payload.schema !== ONBOARDING_PROGRESS_SCHEMA ||
    payload.schema_version !== 2 ||
    !VALID_PROGRESS_STATES.has(payload.state)
  ) {
    throw new Error('onboarding_progress_contract_mismatch');
  }
  return {
    schema: ONBOARDING_PROGRESS_SCHEMA,
    state: payload.state,
    step: Math.min(5, Math.max(1, Number(payload.step) || 1)),
    displayName: String(payload.display_name || ''),
    bio: String(payload.bio || ''),
    interests: Array.isArray(payload.interests) ? payload.interests : [],
    completed: payload.completed === true,
    deferred: payload.deferred === true,
    requiredVersion: Number(payload.required_onboarding_version || 0),
    completedVersion: Number(payload.completed_onboarding_version || 0),
    onboardingRequired: payload.onboarding_required === true,
  };
}

export function enabledFieldsForStep(card, stepId) {
  return (FIELD_GROUPS[stepId] || []).filter(
    field => card?.capabilities?.[field]?.enabled === true,
  );
}

export function editableFieldsForStep(card, stepId) {
  return enabledFieldsForStep(card, stepId).filter(
    field => card.capabilities[field].editable === true,
  );
}

export async function loadAdjusterCardBundle(site) {
  const [profilePayload, progressPayload] = await Promise.all([
    site.jsonApi('/native/v1/profile'),
    site.jsonApi('/native/v1/onboarding'),
  ]);
  return {
    card: parseAdjusterCard(profilePayload),
    progress: parseOnboardingProgress(progressPayload),
  };
}

export async function loadCanonicalOnboarding(site) {
  return parseOnboardingProgress(await site.jsonApi('/native/v1/onboarding'));
}

export async function saveOnboardingProgress(site, data) {
  return parseOnboardingProgress(
    await site.jsonApi('/native/v1/onboarding', 'PUT', data),
  );
}

export async function saveAdjusterCardFields(
  site,
  card,
  changes,
  visibilityChanges = {},
) {
  const fields = {};
  const visibility = {};
  Object.entries(changes || {}).forEach(([field, value]) => {
    const capability = card?.capabilities?.[field];
    if (!capability?.enabled || !capability.editable) return;
    if (value == null || (ENUM_FIELDS.has(field) && value === '')) return;
    fields[field] = value;
    if (capability.visibilityOptions.includes('members')) {
      const requested = visibilityChanges[field];
      visibility[field] = capability.visibilityOptions.includes(requested)
        ? requested
        : card.visibility[field] || 'members';
    }
  });
  if (!Object.keys(fields).length) return card;
  return parseAdjusterCard(
    await site.jsonApi('/native/v1/profile', 'PATCH', {
      fields,
      visibility,
      lock_version: card.lockVersion,
    }),
  );
}

function assertAsset(asset) {
  if (!asset?.uri || !asset?.name || !asset?.mimeType) {
    throw new Error('invalid_upload_asset');
  }
}

export async function uploadPrivateResume(site, card, asset) {
  if (!card?.resume?.enabled || !card.resume.upload) {
    throw new Error('resume_capability_disabled');
  }
  assertAsset(asset);
  if (
    Array.isArray(card.resume.allowed_mime_types) &&
    !card.resume.allowed_mime_types.includes(asset.mimeType)
  ) {
    throw new Error('unsupported_resume_type');
  }
  if (
    card.resume.max_bytes &&
    Number(asset.size || 0) > card.resume.max_bytes
  ) {
    throw new Error('resume_exceeds_size_limit');
  }
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType,
  });
  const payload = await site.multipartApi('/native/v1/profile/resume', form);
  if (payload?.schema !== PRIVATE_RESUME_SCHEMA || !isObject(payload.resume)) {
    throw new Error('private_resume_contract_mismatch');
  }
  return payload.resume;
}

export async function deletePrivateResume(site, card) {
  if (!card?.resume?.enabled || !card.resume.delete) {
    throw new Error('resume_capability_disabled');
  }
  await site.jsonApi('/native/v1/profile/resume', 'DELETE');
  return parseAdjusterCard(await site.jsonApi('/native/v1/profile'));
}

export async function uploadProfilePhoto(site, card, asset) {
  if (
    !card?.photo?.enabled ||
    !card.photo.editable ||
    card.photo.delegatedTo !== 'discourse-avatar'
  ) {
    throw new Error('photo_capability_disabled');
  }
  assertAsset(asset);
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType,
  });
  const payload = await site.multipartApi('/native/v1/profile/photo', form);
  if (
    payload?.schema !== 'an.adjuster-card-photo.v1' ||
    payload?.configured !== true
  ) {
    throw new Error('avatar_upload_failed');
  }
  return {
    ...payload,
    avatarTemplate: String(payload.avatar_template || ''),
  };
}

export async function removeProfilePhoto(site, card) {
  if (!card?.photo?.enabled || !card.photo.editable) {
    throw new Error('photo_capability_disabled');
  }
  const payload = await site.jsonApi('/native/v1/profile/photo', 'DELETE');
  if (
    payload?.schema !== 'an.adjuster-card-photo.v1' ||
    payload?.configured !== false
  ) {
    throw new Error('avatar_remove_failed');
  }
  return payload;
}

export function onboardingStepIndex(progress, card) {
  const hasResume = card?.resume?.enabled === true;
  const lastIndex = hasResume ? PROFILE_STEPS.length - 1 : 3;
  if (progress.state === 'COMPLETED') return lastIndex;
  if (progress.step <= 1) return 0;
  if (progress.step === 2) return 1;
  if (progress.step === 3) return 2;
  if (hasResume && progress.step === 4) return 3;
  return lastIndex;
}

export const onboardingSteps = card =>
  card?.resume?.enabled
    ? PROFILE_STEPS
    : PROFILE_STEPS.filter(step => step.id !== 'resume');

export function localStatusForProgress(progress) {
  if (progress.state === 'COMPLETED') return 'completed';
  if (progress.state === 'INCOMPLETE') return 'incomplete';
  return 'not_started';
}
