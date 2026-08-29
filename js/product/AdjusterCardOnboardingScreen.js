/* @flow */
'use strict';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  deletePrivateResume,
  editableFieldsForStep,
  enabledFieldsForStep,
  FIELD_OPTIONS,
  loadAdjusterCardBundle,
  onboardingStepIndex,
  onboardingSteps,
  policyActionsComplete,
  saveAdjusterCardFields,
  saveOnboardingProgress,
  uploadPrivateResume,
  uploadProfilePhoto,
} from '../adjusterCardClient';
import {
  markOnboardingCompleted,
  markOnboardingSkipped,
} from '../onboardingState';
import { Action, BrandMark, useProductTheme } from './ProductComponents';
import { radius, spacing } from './DesignSystem';
import EmojiTextInput from './EmojiTextInput';

const valueText = value =>
  Array.isArray(value) ? value.join(', ') : String(value || '');
const listValue = (value, upper = false) =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item =>
      upper
        ? item.toUpperCase()
        : item.toLowerCase().replace(/[^a-z0-9_-]+/g, '_'),
    )
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, 20);

const FieldLabel = ({ children, detail }) => {
  const colors = useProductTheme();
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, { color: colors.text }]}>{children}</Text>
      {detail ? (
        <Text style={[styles.labelDetail, { color: colors.muted }]}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
};

const ChoiceField = ({ label, options, value, disabled, onChange }) => {
  const colors = useProductTheme();
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.choices}>
        {options.map(([key, title]) => {
          const selected = value === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(key)}
              style={[
                styles.choice,
                {
                  backgroundColor: selected
                    ? colors.accentSoft
                    : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.choiceText, { color: colors.text }]}>
                {title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const DeferredStep = ({ title, body }) => {
  const colors = useProductTheme();
  return (
    <View
      style={[
        styles.deferred,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.deferredTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
    </View>
  );
};

export default function AdjusterCardOnboardingScreen({
  onComplete,
  onReconnect,
  onSkip,
  sessionId,
  site,
}) {
  const colors = useProductTheme();
  const { fontScale } = useWindowDimensions();
  const [state, setState] = useState({
    loading: true,
    saving: false,
    card: null,
    progress: null,
    step: 0,
    values: {},
    error: null,
    errorStatus: null,
  });
  const [policyActions, setPolicyActions] = useState({});
  const steps = onboardingSteps(state.card);

  const load = useCallback(async () => {
    setState(current => ({
      ...current,
      loading: true,
      error: null,
      errorStatus: null,
    }));
    try {
      const bundle = await loadAdjusterCardBundle(site);
      setState({
        loading: false,
        saving: false,
        card: bundle.card,
        progress: bundle.progress,
        step: onboardingStepIndex(bundle.progress, bundle.card),
        values: {
          ...bundle.card.values,
          name: bundle.card.values.name || bundle.progress.displayName,
          bio: bundle.card.values.bio || bundle.progress.bio,
        },
        error: null,
        errorStatus: null,
      });
    } catch (error) {
      setState(current => ({
        ...current,
        loading: false,
        error:
          error?.status === 429
            ? 'This session needs to reconnect before your saved profile can load.'
            : 'Your saved profile could not be loaded. Please try again.',
        errorStatus: error?.status || null,
      }));
    }
  }, [site]);

  useEffect(() => {
    load();
  }, [load]);

  const updateValue = (field, value) =>
    setState(current => ({
      ...current,
      values: { ...current.values, [field]: value },
      error: null,
    }));

  const choosePhoto = async () => {
    if (state.saving || !state.card.photo.enabled) return;
    setState(current => ({ ...current, saving: true, error: null }));
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('photo_permission_denied');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) {
        return setState(current => ({ ...current, saving: false }));
      }
      const asset = result.assets[0];
      await uploadProfilePhoto(site, state.card, {
        uri: asset.uri,
        name: asset.fileName || 'profile-photo.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
      });
      setState(current => ({ ...current, saving: false }));
    } catch (error) {
      setState(current => ({
        ...current,
        saving: false,
        error:
          error?.message === 'photo_permission_denied'
            ? 'Photo access was not granted.'
            : error?.userMessages?.join(' ') ||
              'Your profile photo could not be updated.',
      }));
    }
  };

  const chooseResume = async () => {
    if (state.saving || !state.card.resume.upload) return;
    setState(current => ({ ...current, saving: true, error: null }));
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: state.card.resume.allowed_mime_types,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) {
        return setState(current => ({ ...current, saving: false }));
      }
      const resumeMetadata = await uploadPrivateResume(
        site,
        state.card,
        result.assets[0],
      );
      setState(current => ({
        ...current,
        card: { ...current.card, resumeMetadata },
        saving: false,
      }));
    } catch (error) {
      setState(current => ({
        ...current,
        saving: false,
        error:
          error?.userMessages?.join(' ') ||
          'Your private résumé could not be uploaded.',
      }));
    }
  };

  const removeResume = () => {
    if (state.saving || !state.card.resume.delete) return;
    Alert.alert(
      'Remove private résumé?',
      'This removes the stored file from your Adjuster Card.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setState(current => ({ ...current, saving: true, error: null }));
            try {
              const card = await deletePrivateResume(site, state.card);
              setState(current => ({ ...current, card, saving: false }));
            } catch (error) {
              setState(current => ({
                ...current,
                saving: false,
                error:
                  error?.userMessages?.join(' ') ||
                  'Your private résumé could not be removed.',
              }));
            }
          },
        },
      ],
    );
  };

  const saveFieldsFor = async stepId => {
    const editable = editableFieldsForStep(state.card, stepId);
    const changes = {};
    editable.forEach(field => {
      changes[field] = state.values[field];
    });
    const card = await saveAdjusterCardFields(site, state.card, changes);
    return card;
  };

  const persistAndContinue = async () => {
    const stepId = steps[state.step].id;
    setState(current => ({ ...current, saving: true, error: null }));
    try {
      const card = await saveFieldsFor(stepId);
      const nextStep = Math.min(state.step + 1, steps.length - 1);
      const progress = await saveOnboardingProgress(site, {
        onboarding_action: 'continue',
        step: Math.min(5, state.step + 1),
        display_name: state.values.name || '',
        bio: state.values.bio || '',
      });
      setState(current => ({
        ...current,
        card,
        progress,
        step: nextStep,
        saving: false,
      }));
    } catch (error) {
      setState(current => ({
        ...current,
        saving: false,
        error:
          error?.userMessages?.join(' ') ||
          'Your progress could not be saved. Please try again.',
      }));
    }
  };

  const goBack = async () => {
    if (state.step === 0 || state.saving) return;
    setState(current => ({ ...current, saving: true, error: null }));
    try {
      const progress = await saveOnboardingProgress(site, {
        onboarding_action: 'back',
        step: Math.min(5, state.step + 1),
      });
      setState(current => ({
        ...current,
        progress,
        step: current.step - 1,
        saving: false,
      }));
    } catch {
      setState(current => ({
        ...current,
        saving: false,
        error: 'Your progress could not be saved. Please try again.',
      }));
    }
  };

  const skipForNow = async () => {
    if (state.saving) return;
    setState(current => ({ ...current, saving: true, error: null }));
    try {
      await saveFieldsFor(steps[state.step].id);
      const progress = await saveOnboardingProgress(site, {
        onboarding_action: 'skip_for_now',
        step: Math.min(5, state.step + 1),
        display_name: state.values.name || '',
        bio: state.values.bio || '',
      });
      const localState = await markOnboardingSkipped(sessionId);
      setState(current => ({
        ...current,
        progress,
        saving: false,
        error:
          'Your progress is saved. Finish setup before entering the member network.',
      }));
      onSkip(localState);
    } catch (error) {
      setState(current => ({
        ...current,
        saving: false,
        error:
          error?.userMessages?.join(' ') ||
          'Your progress could not be saved. Please try again.',
      }));
    }
  };

  const finish = async () => {
    if (state.saving) return;
    setState(current => ({ ...current, saving: true, error: null }));
    try {
      const policy = state.progress.policy;
      if (!policyActionsComplete(policy, policyActions)) {
        throw new Error('required_policy_action_missing');
      }
      const changes = {};
      for (const stepId of ['profile', 'licenses', 'experience']) {
        editableFieldsForStep(state.card, stepId).forEach(field => {
          changes[field] = state.values[field];
        });
      }
      await saveAdjusterCardFields(site, state.card, changes);
      const progress = await saveOnboardingProgress(site, {
        onboarding_action: 'finish',
        step: 5,
        display_name: state.values.name || '',
        bio: state.values.bio || '',
        policy_set_key: policy.setKey,
        policy_set_version: policy.setVersion,
        policy_set_sha256: policy.setSha256,
        policy_actions: policyActions,
      });
      if (progress.state !== 'COMPLETED') {
        throw new Error('onboarding_completion_not_confirmed');
      }
      const localState = await markOnboardingCompleted([]);
      onComplete(localState);
    } catch (error) {
      setState(current => ({
        ...current,
        saving: false,
        error:
          error?.message === 'required_policy_action_missing'
            ? 'Review each required document and record your agreement before finishing.'
            : error?.userMessages?.join(' ') ||
              'Your profile could not be finished. Please try again.',
      }));
    }
  };

  const stepId = steps[state.step]?.id || 'profile';
  const enabled = useMemo(
    () => enabledFieldsForStep(state.card, stepId),
    [state.card, stepId],
  );

  if (state.loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.body, { color: colors.muted }]}>
            Loading your Adjuster Card…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!state.card || !state.progress) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
        <View style={styles.center}>
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {state.error}
          </Text>
          {state.errorStatus === 429 && onReconnect ? (
            <Action label="Reconnect" onPress={onReconnect} />
          ) : (
            <Action label="Try again" secondary onPress={load} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safe}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            fontScale >= 1.6 && styles.accessibilityContent,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <BrandMark />
            <Text style={[styles.eyebrow, { color: colors.muted }]}>
              Build your Adjuster Card
            </Text>
          </View>
          <View
            accessibilityLabel={`Step ${state.step + 1} of ${steps.length}: ${
              steps[state.step].title
            }`}
            style={styles.progress}
          >
            {steps.map((step, index) => (
              <View
                key={step.id}
                style={[
                  styles.progressSegment,
                  {
                    backgroundColor:
                      index <= state.step ? colors.accent : colors.border,
                  },
                ]}
              />
            ))}
          </View>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            {steps[state.step].title}
          </Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            {stepId === 'profile'
              ? 'Add professional context that helps members know who they are speaking with.'
              : stepId === 'licenses'
              ? 'Share licensed states only. License numbers and expiration dates are not collected.'
              : stepId === 'experience'
              ? 'Add only the experience fields currently approved for the Network.'
              : stepId === 'resume'
              ? 'A résumé is private and never enables recruiter access or member search.'
              : 'Review the member-visible details before finishing.'}
          </Text>

          {stepId === 'profile' ? (
            <View style={styles.form}>
              {state.card.photo.enabled ? (
                <View style={styles.mediaActions}>
                  <DeferredStep
                    title="Profile photo"
                    body="Photo editing uses the secure Discourse avatar service."
                  />
                  <Action
                    disabled={state.saving || !state.card.photo.editable}
                    label="Choose profile photo"
                    onPress={choosePhoto}
                    secondary
                  />
                </View>
              ) : null}
              {enabled.includes('name') ? (
                <View style={styles.fieldGroup}>
                  <FieldLabel detail="Visible to Network members">
                    Name
                  </FieldLabel>
                  <EmojiTextInput
                    accessibilityLabel="Professional or display name"
                    editable={!state.saving}
                    maxLength={80}
                    onChangeText={value => updateValue('name', value)}
                    placeholder="Professional or display name"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    value={valueText(state.values.name)}
                  />
                </View>
              ) : null}
              {enabled.includes('professional_headline') ? (
                <View style={styles.fieldGroup}>
                  <FieldLabel detail="Visible according to your profile setting">
                    Professional headline
                  </FieldLabel>
                  <EmojiTextInput
                    accessibilityLabel="Professional headline"
                    editable={!state.saving}
                    maxLength={120}
                    onChangeText={value =>
                      updateValue('professional_headline', value)
                    }
                    placeholder="Property adjuster · residential field work"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    value={valueText(state.values.professional_headline)}
                  />
                </View>
              ) : null}
              {enabled.includes('bio') ? (
                <View style={styles.fieldGroup}>
                  <FieldLabel detail="Visible to Network members">
                    Bio
                  </FieldLabel>
                  <EmojiTextInput
                    accessibilityLabel="Professional bio"
                    editable={!state.saving}
                    maxLength={500}
                    multiline
                    onChangeText={value => updateValue('bio', value)}
                    placeholder="A short professional introduction"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.input,
                      styles.multiline,
                      {
                        color: colors.text,
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    textAlignVertical="top"
                    value={valueText(state.values.bio)}
                  />
                </View>
              ) : null}
              {enabled.includes('base_state') ? (
                <View style={styles.fieldGroup}>
                  <FieldLabel detail="Two-letter state abbreviation">
                    Base state
                  </FieldLabel>
                  <EmojiTextInput
                    accessibilityLabel="Base state"
                    autoCapitalize="characters"
                    editable={!state.saving}
                    maxLength={2}
                    onChangeText={value =>
                      updateValue('base_state', value.trim().toUpperCase())
                    }
                    placeholder="FL"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    value={valueText(state.values.base_state)}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {stepId === 'licenses' ? (
            enabled.includes('licensed_states') ? (
              <View style={styles.fieldGroup}>
                <FieldLabel detail="Two-letter abbreviations, separated by commas">
                  Licensed states
                </FieldLabel>
                <EmojiTextInput
                  accessibilityLabel="Licensed states"
                  autoCapitalize="characters"
                  editable={!state.saving}
                  onChangeText={value =>
                    updateValue('licensed_states', listValue(value, true))
                  }
                  placeholder="FL, GA, TX"
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  value={valueText(state.values.licensed_states)}
                />
              </View>
            ) : (
              <DeferredStep
                title="Licensing details are not enabled yet"
                body="No license information will be stored on this device. Continue now and add licensed states when the server enables that field."
              />
            )
          ) : null}

          {stepId === 'experience' ? (
            enabled.length ? (
              <View style={styles.form}>
                {enabled
                  .filter(field => FIELD_OPTIONS[field])
                  .map(field => (
                    <ChoiceField
                      key={field}
                      disabled={state.saving}
                      label={field.replaceAll('_', ' ')}
                      onChange={value => updateValue(field, value)}
                      options={FIELD_OPTIONS[field]}
                      value={state.values[field]}
                    />
                  ))}
                {enabled.includes('specialties') ? (
                  <View style={styles.fieldGroup}>
                    <FieldLabel detail="Short terms separated by commas">
                      Specialties
                    </FieldLabel>
                    <EmojiTextInput
                      accessibilityLabel="Professional specialties"
                      editable={!state.saving}
                      onChangeText={value =>
                        updateValue('specialties', listValue(value))
                      }
                      placeholder="property, auto, catastrophe"
                      placeholderTextColor={colors.muted}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      value={valueText(state.values.specialties)}
                    />
                  </View>
                ) : null}
              </View>
            ) : (
              <DeferredStep
                title="Experience fields are not enabled yet"
                body="The server has not approved any structured experience fields. Nothing entered here is stored locally."
              />
            )
          ) : null}

          {stepId === 'resume' ? (
            state.card.resume.enabled ? (
              <View style={styles.mediaActions}>
                <DeferredStep
                  title={
                    state.card.resumeMetadata.state === 'available'
                      ? 'Private résumé saved'
                      : 'Private résumé upload available'
                  }
                  body="The file remains owner-only, is malware scanned, is never public, and is not available to recruiter search."
                />
                <Action
                  disabled={state.saving || !state.card.resume.upload}
                  label={
                    state.card.resumeMetadata.state === 'available'
                      ? 'Replace résumé'
                      : 'Upload résumé'
                  }
                  onPress={chooseResume}
                  secondary
                />
                {state.card.resumeMetadata.state === 'available' &&
                state.card.resume.delete ? (
                  <Action
                    disabled={state.saving}
                    label="Remove résumé"
                    onPress={removeResume}
                    secondary
                  />
                ) : null}
              </View>
            ) : (
              <DeferredStep
                title="Private résumé storage is not enabled yet"
                body="No file selector or local copy is created while this capability is off. You can finish your profile without a résumé."
              />
            )
          ) : null}

          {stepId === 'preview' ? (
            <View style={styles.previewGroup}>
              <View
                accessibilityLabel="Adjuster Card preview"
                style={[
                  styles.preview,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.previewName, { color: colors.text }]}>
                  {state.values.name || 'Your professional name'}
                </Text>
                {state.values.professional_headline ? (
                  <Text
                    style={[styles.previewHeadline, { color: colors.accent }]}
                  >
                    {state.values.professional_headline}
                  </Text>
                ) : null}
                {state.values.bio ? (
                  <Text style={[styles.body, { color: colors.muted }]}>
                    {state.values.bio}
                  </Text>
                ) : null}
                {Array.isArray(state.values.licensed_states) &&
                state.values.licensed_states.length ? (
                  <Text style={[styles.meta, { color: colors.muted }]}>
                    Licensed: {state.values.licensed_states.join(', ')}
                  </Text>
                ) : null}
                <Text style={[styles.privateNote, { color: colors.muted }]}>
                  Only server-enabled fields are shown. Résumés remain private
                  and recruiter search is off.
                </Text>
              </View>
              <View
                style={[
                  styles.policyPanel,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.label, { color: colors.text }]}>
                  Required documents
                </Text>
                {!state.progress.policy.available ? (
                  <Text
                    accessibilityRole="alert"
                    style={[styles.body, { color: colors.danger }]}
                  >
                    Required documents are temporarily unavailable. Try again
                    before finishing.
                  </Text>
                ) : (
                  state.progress.policy.instruments.map(instrument => {
                    const selected =
                      instrument.satisfied ||
                      policyActions[instrument.key] ===
                        instrument.requiredAction;
                    return (
                      <View
                        key={`${instrument.key}:${instrument.version}`}
                        style={styles.policyInstrument}
                      >
                        <Pressable
                          accessibilityRole="link"
                          onPress={() =>
                            Linking.openURL(
                              `${site.url}${instrument.document.path}`,
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.policyLink,
                              { color: colors.accent },
                            ]}
                          >
                            Review {instrument.document.title} ·{' '}
                            {instrument.version}
                          </Text>
                        </Pressable>
                        {instrument.requiredAction ? (
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{
                              checked: selected,
                              disabled: instrument.satisfied || state.saving,
                            }}
                            disabled={instrument.satisfied || state.saving}
                            onPress={() =>
                              setPolicyActions(current => ({
                                ...current,
                                [instrument.key]:
                                  current[instrument.key] ===
                                  instrument.requiredAction
                                    ? undefined
                                    : instrument.requiredAction,
                              }))
                            }
                            style={styles.policyAction}
                          >
                            <Text
                              style={[styles.checkbox, { color: colors.text }]}
                            >
                              {selected ? '☑' : '☐'}
                            </Text>
                            <Text
                              style={[
                                styles.policyText,
                                { color: colors.text },
                              ]}
                            >
                              {instrument.satisfied
                                ? 'Previously recorded'
                                : instrument.presentation}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text
                            style={[styles.policyInfo, { color: colors.muted }]}
                          >
                            Available for review; no acceptance is recorded.
                          </Text>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          ) : null}

          {state.error ? (
            <Text
              accessibilityRole="alert"
              style={[styles.error, { color: colors.danger }]}
            >
              {state.error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {state.step === steps.length - 1 ? (
              <Action
                disabled={
                  state.saving ||
                  !policyActionsComplete(state.progress.policy, policyActions)
                }
                icon="check"
                label={state.saving ? 'Finishing…' : 'Finish profile'}
                onPress={finish}
              />
            ) : (
              <Action
                disabled={state.saving}
                label={state.saving ? 'Saving…' : 'Save and continue'}
                onPress={persistAndContinue}
              />
            )}
            {state.step > 0 ? (
              <Action
                disabled={state.saving}
                label="Back"
                onPress={goBack}
                secondary
              />
            ) : null}
            <Pressable
              accessibilityHint="Your saved progress remains incomplete and onboarding returns after your next new login"
              accessibilityRole="button"
              disabled={state.saving}
              onPress={skipForNow}
              style={styles.skipButton}
            >
              <Text style={[styles.skip, { color: colors.muted }]}>
                Skip for now
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  accessibilityContent: { paddingTop: spacing.sm, paddingBottom: 72 },
  previewGroup: { gap: spacing.md },
  policyPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  policyInstrument: { gap: spacing.xs, paddingVertical: spacing.xs },
  policyLink: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  policyAction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: 44,
  },
  checkbox: { fontSize: 22, lineHeight: 28 },
  policyText: { flex: 1, fontSize: 14, lineHeight: 20 },
  policyInfo: { fontSize: 13, lineHeight: 19 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  progress: { flexDirection: 'row', gap: 5, marginTop: spacing.md },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '800',
    marginTop: spacing.lg,
  },
  body: { fontSize: 16, lineHeight: 24, marginTop: spacing.xs },
  form: { marginTop: spacing.md, gap: spacing.md },
  fieldGroup: { marginTop: spacing.md },
  labelRow: { gap: 2, marginBottom: spacing.xs },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  labelDetail: { fontSize: 12, lineHeight: 17 },
  input: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  multiline: { minHeight: 120 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  choiceText: { fontSize: 14, fontWeight: '650' },
  deferred: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  mediaActions: { gap: spacing.sm },
  deferredTitle: { fontSize: 17, fontWeight: '750' },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  previewName: { fontSize: 23, lineHeight: 29, fontWeight: '800' },
  previewHeadline: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 3,
  },
  meta: { fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  privateNote: { fontSize: 12, lineHeight: 18, marginTop: spacing.md },
  error: { fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  skipButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skip: { fontSize: 15, fontWeight: '650' },
});
