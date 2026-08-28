/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';
import {
  ADJUSTER_CARD_SCHEMA,
  editableFieldsForStep,
  enabledFieldsForStep,
  loadAdjusterCardBundle,
  localStatusForProgress,
  ONBOARDING_PROGRESS_SCHEMA,
  onboardingStepIndex,
  onboardingSteps,
  parseAdjusterCard,
  parseOnboardingProgress,
  PRIVATE_RESUME_SCHEMA,
  removeProfilePhoto,
  saveAdjusterCardFields,
  saveOnboardingProgress,
  uploadPrivateResume,
  uploadProfilePhoto,
} from '../adjusterCardClient';

const profilePayload = overrides => ({
  schema: ADJUSTER_CARD_SCHEMA,
  schema_version: 2,
  enabled: false,
  enabled_fields: [],
  core: { name: 'QA Adjuster', bio: 'Property adjuster' },
  fields: {},
  visibility: {},
  capabilities: {
    fields: {
      name: {
        enabled: true,
        readable: true,
        editable: true,
        visibility_options: ['members'],
      },
      bio: {
        enabled: true,
        readable: true,
        editable: true,
        visibility_options: ['members'],
      },
      professional_headline: {
        enabled: false,
        readable: false,
        editable: false,
        visibility_options: ['self', 'members', 'staff'],
      },
      licensed_states: {
        enabled: false,
        readable: false,
        editable: false,
        visibility_options: ['self', 'members', 'staff'],
      },
    },
    photo: {
      enabled: false,
      delegated_to: 'discourse-avatar',
      editable: false,
      public_url: false,
    },
    resume: {
      schema: PRIVATE_RESUME_SCHEMA,
      enabled: false,
      owner_only: true,
      upload: false,
      read: false,
      replace: false,
      delete: false,
      public_url: false,
      recruiter_access: false,
      search_indexed: false,
    },
    recruiter_search: { enabled: false },
  },
  resume: { state: 'absent', public_url: false },
  lock_version: 0,
  editable: true,
  ...overrides,
});

const progressPayload = overrides => ({
  schema: ONBOARDING_PROGRESS_SCHEMA,
  schema_version: 2,
  state: 'NOT_STARTED',
  step: 1,
  display_name: '',
  bio: '',
  interests: [],
  completed: false,
  skipped_optional: false,
  deferred: false,
  ...overrides,
});

describe('AN-2870 Adjuster Card contracts', () => {
  test('binds to the exact deployed contract versions and fails closed', () => {
    expect(parseAdjusterCard(profilePayload()).schema).toBe(
      'an.adjuster-card.v2',
    );
    expect(parseOnboardingProgress(progressPayload()).schema).toBe(
      'an.onboarding-progress.v2',
    );
    expect(() =>
      parseAdjusterCard(profilePayload({ schema: 'an.adjuster-card.v1' })),
    ).toThrow('adjuster_card_contract_mismatch');
    expect(() =>
      parseOnboardingProgress(
        progressPayload({ schema: 'an.onboarding-progress.v1' }),
      ),
    ).toThrow('onboarding_progress_contract_mismatch');
  });

  test('production-off capabilities expose only canonical core fields', () => {
    const card = parseAdjusterCard(
      profilePayload({
        fields: {
          professional_headline: 'must not leak',
          licensed_states: ['FL'],
        },
      }),
    );

    expect(enabledFieldsForStep(card, 'profile')).toEqual(['name', 'bio']);
    expect(enabledFieldsForStep(card, 'licenses')).toEqual([]);
    expect(card.values.professional_headline).toBeUndefined();
    expect(card.values.licensed_states).toBeUndefined();
    expect(card.photo.enabled).toBe(false);
    expect(card.resume).toMatchObject({
      schema: 'an.private-resume.v1',
      enabled: false,
      upload: false,
      public_url: false,
      recruiter_access: false,
      search_indexed: false,
    });
    expect(card.recruiterSearchEnabled).toBe(false);
  });

  test('parses the server-filtered member Adjuster Card as read-only', () => {
    const card = parseAdjusterCard({
      schema: ADJUSTER_CARD_SCHEMA,
      schema_version: 2,
      enabled: true,
      enabled_fields: ['professional_headline', 'base_state'],
      core: {
        name: 'Visible Member',
        bio: 'Member-visible bio',
        avatar_template: '/user_avatar/example/{size}/1.png',
      },
      fields: {
        professional_headline: 'Property adjuster',
        base_state: 'OH',
      },
      capabilities: {
        photo: { enabled: true, readable: true, editable: false },
        recruiter_search: { enabled: false },
      },
      editable: false,
    });

    expect(card.editable).toBe(false);
    expect(card.values).toEqual({
      name: 'Visible Member',
      bio: 'Member-visible bio',
      professional_headline: 'Property adjuster',
      base_state: 'OH',
    });
    expect(card.values.licensed_states).toBeUndefined();
    expect(card.resume.enabled).toBe(false);
    expect(card.avatarTemplate).toContain('{size}');
  });

  test('skips the disabled Resume step without changing the V2 lifecycle', () => {
    const card = parseAdjusterCard(profilePayload());
    expect(onboardingSteps(card).map(step => step.id)).toEqual([
      'profile',
      'licenses',
      'experience',
      'preview',
    ]);
    expect(
      onboardingStepIndex(
        parseOnboardingProgress(progressPayload({ step: 4 })),
        card,
      ),
    ).toBe(3);
  });

  test('certification fixture renders and edits only server-enabled fields', () => {
    const base = profilePayload();
    const card = parseAdjusterCard(
      profilePayload({
        enabled: true,
        enabled_fields: ['professional_headline', 'licensed_states'],
        fields: {
          professional_headline: 'Field adjuster',
          licensed_states: ['FL', 'GA'],
        },
        capabilities: {
          ...base.capabilities,
          fields: {
            ...base.capabilities.fields,
            professional_headline: {
              enabled: true,
              readable: true,
              editable: true,
              visibility_options: ['self', 'members', 'staff'],
            },
            licensed_states: {
              enabled: true,
              readable: true,
              editable: true,
              visibility_options: ['self', 'members', 'staff'],
            },
          },
        },
      }),
    );

    expect(enabledFieldsForStep(card, 'profile')).toEqual([
      'name',
      'professional_headline',
      'bio',
    ]);
    expect(editableFieldsForStep(card, 'licenses')).toEqual([
      'licensed_states',
    ]);
    expect(card.values.licensed_states).toEqual(['FL', 'GA']);
  });

  test('certification media gates remain owner-only and private when enabled', () => {
    const base = profilePayload();
    const card = parseAdjusterCard(
      profilePayload({
        capabilities: {
          ...base.capabilities,
          photo: {
            enabled: true,
            delegated_to: 'discourse-avatar',
            editable: true,
            public_url: false,
          },
          resume: {
            schema: PRIVATE_RESUME_SCHEMA,
            enabled: true,
            owner_only: true,
            upload: true,
            read: true,
            replace: true,
            delete: true,
            public_url: false,
            recruiter_access: false,
            search_indexed: false,
          },
          recruiter_search: { enabled: false },
        },
      }),
    );

    expect(card.photo).toEqual({
      enabled: true,
      editable: true,
      delegatedTo: 'discourse-avatar',
      publicUrl: false,
    });
    expect(card.resume).toMatchObject({
      enabled: true,
      owner_only: true,
      upload: true,
      replace: true,
      delete: true,
      public_url: false,
      recruiter_access: false,
      search_indexed: false,
    });
    expect(card.recruiterSearchEnabled).toBe(false);
  });

  test('enabled media mutations use only the contracted authenticated paths', async () => {
    const OriginalFormData = global.FormData;
    global.FormData = class {
      values = [];
      append(key, value) {
        this.values.push([key, value]);
      }
    };
    try {
      const base = profilePayload();
      const card = parseAdjusterCard(
        profilePayload({
          capabilities: {
            ...base.capabilities,
            photo: {
              enabled: true,
              delegated_to: 'discourse-avatar',
              editable: true,
              public_url: false,
            },
            resume: {
              schema: PRIVATE_RESUME_SCHEMA,
              enabled: true,
              owner_only: true,
              upload: true,
              read: true,
              replace: true,
              delete: true,
              allowed_mime_types: ['application/pdf'],
              max_bytes: 1000,
              public_url: false,
              recruiter_access: false,
              search_indexed: false,
            },
          },
        }),
      );
      const site = {
        username: 'qa_test',
        multipartApi: jest
          .fn()
          .mockResolvedValueOnce({
            schema: PRIVATE_RESUME_SCHEMA,
            resume: { state: 'available', public_url: false },
          })
          .mockResolvedValueOnce({
            schema: 'an.adjuster-card-photo.v1',
            configured: true,
            avatar_template: '/user_avatar/example/{size}/2.png',
          }),
        jsonApi: jest.fn(() =>
          Promise.resolve({
            schema: 'an.adjuster-card-photo.v1',
            configured: false,
          }),
        ),
      };

      await expect(
        uploadPrivateResume(site, card, {
          uri: 'file:///synthetic.pdf',
          name: 'synthetic.pdf',
          mimeType: 'application/pdf',
          size: 100,
        }),
      ).resolves.toEqual({ state: 'available', public_url: false });
      await expect(
        uploadProfilePhoto(site, card, {
          uri: 'file:///synthetic.jpg',
          name: 'synthetic.jpg',
          mimeType: 'image/jpeg',
        }),
      ).resolves.toMatchObject({
        avatarTemplate: '/user_avatar/example/{size}/2.png',
      });
      await removeProfilePhoto(site, card);

      expect(site.multipartApi).toHaveBeenNthCalledWith(
        1,
        '/native/v1/profile/resume',
        expect.anything(),
      );
      expect(site.multipartApi).toHaveBeenNthCalledWith(
        2,
        '/native/v1/profile/photo',
        expect.anything(),
      );
      expect(site.jsonApi).toHaveBeenCalledWith(
        '/native/v1/profile/photo',
        'DELETE',
      );
    } finally {
      global.FormData = OriginalFormData;
    }
  });

  test('disabled media capabilities reject before opening an upload path', async () => {
    const card = parseAdjusterCard(profilePayload());
    const site = { multipartApi: jest.fn(), jsonApi: jest.fn() };
    const asset = {
      uri: 'file:///synthetic.pdf',
      name: 'synthetic.pdf',
      mimeType: 'application/pdf',
    };

    await expect(uploadPrivateResume(site, card, asset)).rejects.toThrow(
      'resume_capability_disabled',
    );
    await expect(uploadProfilePhoto(site, card, asset)).rejects.toThrow(
      'photo_capability_disabled',
    );
    expect(site.multipartApi).not.toHaveBeenCalled();
  });

  test('partial save sends only editable capability-approved fields', async () => {
    const base = profilePayload();
    const enabledResponse = profilePayload({
      enabled: true,
      enabled_fields: ['professional_headline'],
      fields: { professional_headline: 'Updated' },
      capabilities: {
        ...base.capabilities,
        fields: {
          ...base.capabilities.fields,
          professional_headline: {
            enabled: true,
            readable: true,
            editable: true,
            visibility_options: ['self', 'members', 'staff'],
          },
        },
      },
      lock_version: 2,
    });
    const site = { jsonApi: jest.fn(() => Promise.resolve(enabledResponse)) };
    const card = parseAdjusterCard({ ...enabledResponse, lock_version: 1 });

    await saveAdjusterCardFields(site, card, {
      professional_headline: 'Updated',
      licensed_states: ['FL'],
    });

    expect(site.jsonApi).toHaveBeenCalledWith('/native/v1/profile', 'PATCH', {
      fields: { professional_headline: 'Updated' },
      visibility: { professional_headline: 'members' },
      lock_version: 1,
    });
  });

  test('skip and finish use server progress without conflating states', async () => {
    const site = {
      jsonApi: jest
        .fn()
        .mockResolvedValueOnce(
          progressPayload({ state: 'INCOMPLETE', deferred: true, step: 3 }),
        )
        .mockResolvedValueOnce(
          progressPayload({
            state: 'COMPLETED',
            completed: true,
            step: 4,
          }),
        ),
    };

    const skipped = await saveOnboardingProgress(site, {
      onboarding_action: 'skip_for_now',
      step: 3,
    });
    const completed = await saveOnboardingProgress(site, {
      onboarding_action: 'finish',
      step: 4,
    });

    expect(localStatusForProgress(skipped)).toBe('incomplete');
    expect(localStatusForProgress(completed)).toBe('completed');
    expect(site.jsonApi).toHaveBeenNthCalledWith(
      1,
      '/native/v1/onboarding',
      'PUT',
      { onboarding_action: 'skip_for_now', step: 3 },
    );
  });

  test('loads profile and progress together and resumes the supported step', async () => {
    const site = {
      jsonApi: jest
        .fn()
        .mockResolvedValueOnce(profilePayload())
        .mockResolvedValueOnce(
          progressPayload({ state: 'INCOMPLETE', step: 3 }),
        ),
    };
    const bundle = await loadAdjusterCardBundle(site);

    expect(bundle.progress.state).toBe('INCOMPLETE');
    expect(onboardingStepIndex(bundle.progress, bundle.card)).toBe(2);
    expect(site.jsonApi).toHaveBeenCalledWith('/native/v1/profile');
    expect(site.jsonApi).toHaveBeenCalledWith('/native/v1/onboarding');
  });

  test('the native UI has one server-backed model and no profile shadow key', () => {
    const onboarding = fs.readFileSync(
      path.join(__dirname, '../product/AdjusterCardOnboardingScreen.js'),
      'utf8',
    );
    const profile = fs.readFileSync(
      path.join(__dirname, '../product/NativeProfileScreen.js'),
      'utf8',
    );
    const profileData = fs.readFileSync(
      path.join(__dirname, '../product/memberProfileData.js'),
      'utf8',
    );
    const root = fs.readFileSync(
      path.join(__dirname, '../Discourse.js'),
      'utf8',
    );

    expect(onboarding).toContain('loadAdjusterCardBundle(site)');
    expect(onboarding).toContain("onboarding_action: 'skip_for_now'");
    expect(onboarding).toContain("onboarding_action: 'finish'");
    expect(onboarding).toContain('state.card.photo.enabled');
    expect(onboarding).toContain('state.card.resume.enabled');
    expect(onboarding).toContain(
      'No file selector or local copy is created while this capability is off.',
    );
    expect(profileData).toContain("? '/native/v1/profile'");
    expect(profileData).toContain('`/native/v1/profiles/${encoded}`');
    expect(profile).toContain('saveAdjusterCardFields(');
    expect(root).toContain('loadCanonicalOnboarding(site)');
    expect(onboarding).not.toContain('AsyncStorage');
    expect(profile).not.toContain('AsyncStorage');
  });
});
