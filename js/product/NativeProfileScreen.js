/* @flow */
'use strict';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  canStartProfileSave,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'html-entities';
import { activeMemberSite } from './ProductData';
import {
  Action,
  InlineState,
  NestedHeader,
  useProductTheme,
} from './ProductComponents';
import { radius, spacing } from './DesignSystem';
import {
  FIELD_LABELS,
  optionLabel,
  SPECIALTY_OPTIONS,
  stateLabel,
  US_STATES,
  visibilityLabel,
} from './adjusterCardPresentation';
import {
  cachedMemberProfileData,
  loadMemberProfileData,
  updateCachedMemberProfileAvatar,
} from './memberProfileData';
import {
  profileCooldownSeconds,
  profileRetryAfterMs,
  profileSaveErrorMessage,
  runProfileSaveSequence,
} from './profileSaveState';
import ProfileSaveCooldownControl from './ProfileSaveCooldownControl';
import {
  createProfileMountId,
  profileErrorCategory,
  recordProfileDiagnostic,
} from '../profileDiagnostics';
import {
  deletePrivateResume,
  editableFieldsForStep,
  FIELD_OPTIONS,
  parseAdjusterCard,
  removeProfilePhoto,
  saveAdjusterCardFields,
  uploadPrivateResume,
  uploadProfilePhoto,
} from '../adjusterCardClient';

const plainText = value =>
  decode(
    String(value || '')
      .replace(/<[^>]+>/g, '')
      .trim(),
  );

const avatarUrl = (site, template) => {
  if (!template) return null;
  const path = String(template).replace('{size}', '120');
  return path.startsWith('http') ? path : `${site.url}${path}`;
};

export default function NativeProfileScreen({
  navigation,
  route,
  screenProps,
}) {
  const colors = useProductTheme();
  const site = activeMemberSite(screenProps.siteManager);
  const username = route.params.username;
  const mountIdRef = useRef(null);
  if (mountIdRef.current == null) {
    mountIdRef.current = createProfileMountId();
    recordProfileDiagnostic({
      event: 'cache',
      mountId: mountIdRef.current,
      outcome: 'attempted',
    });
  }
  const mountId = mountIdRef.current;
  const cached = cachedMemberProfileData(site, username);
  const cacheResultRecorded = useRef(false);
  if (!cacheResultRecorded.current) {
    cacheResultRecorded.current = true;
    recordProfileDiagnostic({
      event: 'cache',
      mountId,
      outcome: cached == null ? 'miss' : 'hit',
    });
  }
  const [state, setState] = useState({
    loading: false,
    refreshing: true,
    user: cached?.profile?.user || cached?.profile || null,
    card: cached?.cardPayload ? parseAdjusterCard(cached.cardPayload) : null,
    actions: [],
    error: null,
    source: cached == null ? 'none' : 'cached',
  });
  const [editor, setEditor] = useState({
    visible: false,
    name: '',
    professional_headline: '',
    bio: '',
    base_state: '',
    licensed_states: [],
    specialties: [],
    adjuster_type: '',
    years_experience: '',
    cat_experience: '',
    cat_availability: '',
    work_mode: '',
    travel_preference: '',
    visibility: {},
    photoAsset: null,
    photoPreviewUri: null,
    submitting: false,
    cooldownUntil: 0,
    error: null,
  });
  const [selectionField, setSelectionField] = useState(null);
  const [profileSaveNow, setProfileSaveNow] = useState(Date.now());
  const loadSequence = useRef(0);
  const authoritativeAvatar = useRef(null);
  const lastRenderBranch = useRef(null);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    recordProfileDiagnostic({
      event: 'load',
      mountId,
      sequence,
      outcome: 'invoked',
    });
    if (!site?.authToken)
      return setState({
        loading: false,
        refreshing: false,
        user: null,
        card: null,
        actions: [],
        error: 'signed_out',
        source: 'none',
      });
    setState(current => {
      const loading = false;
      recordProfileDiagnostic({
        event: 'state',
        mountId,
        sequence,
        stage: 'loading',
        loading,
        error: 'none',
      });
      return { ...current, loading, refreshing: true, error: null };
    });
    try {
      const { profile, activity, cardPayload } = await loadMemberProfileData(
        site,
        username,
        { mountId, sequence },
      );
      const accepted = sequence === loadSequence.current;
      recordProfileDiagnostic({
        event: 'sequence',
        mountId,
        sequence,
        currentSequence: loadSequence.current,
        outcome: accepted ? 'accepted' : 'discarded',
        stage: 'profile_bundle',
      });
      if (!accepted) return;
      setState(() => {
        let user = profile?.user || profile;
        let card = cardPayload ? parseAdjusterCard(cardPayload) : null;
        const latestAvatar = authoritativeAvatar.current;
        const responseAvatar =
          card?.avatarTemplate || user?.avatar_template || null;
        if (latestAvatar && responseAvatar !== latestAvatar) {
          user = user ? { ...user, avatar_template: latestAvatar } : user;
          card = card ? { ...card, avatarTemplate: latestAvatar } : card;
          updateCachedMemberProfileAvatar(site, username, latestAvatar);
        } else if (latestAvatar && responseAvatar === latestAvatar) {
          authoritativeAvatar.current = null;
        }
        return {
          loading: false,
          refreshing: false,
          user,
          card,
          actions: [],
          error: null,
          source: 'loaded',
        };
      });
      recordProfileDiagnostic({
        event: 'state',
        mountId,
        sequence,
        stage: 'profile_loaded',
        loading: false,
        refreshing: false,
        error: 'none',
      });
      recordProfileDiagnostic({
        event: 'contributions',
        mountId,
        sequence,
        outcome: 'started',
      });
      const actions = activity?.user_actions || [];
      recordProfileDiagnostic({
        event: 'contributions',
        mountId,
        sequence,
        outcome: 'settled',
      });
      const acceptedActions = sequence === loadSequence.current;
      recordProfileDiagnostic({
        event: 'sequence',
        mountId,
        sequence,
        currentSequence: loadSequence.current,
        outcome: acceptedActions ? 'accepted' : 'discarded',
        stage: 'contributions',
      });
      if (!acceptedActions) return;
      setState(current => ({ ...current, actions }));
    } catch (error) {
      const accepted = sequence === loadSequence.current;
      recordProfileDiagnostic({
        event: 'sequence',
        mountId,
        sequence,
        currentSequence: loadSequence.current,
        outcome: accepted ? 'accepted' : 'discarded',
        stage: 'profile_error',
        category: profileErrorCategory(error),
      });
      if (!accepted) return;
      setState(current => ({
        ...current,
        loading: false,
        error: 'failed',
      }));
      recordProfileDiagnostic({
        event: 'state',
        mountId,
        sequence,
        stage: 'profile_error',
        loading: false,
        error: 'failed',
        category: profileErrorCategory(error),
      });
    }
  }, [mountId, site, username]);

  useEffect(() => {
    recordProfileDiagnostic({ event: 'mount', mountId, outcome: 'mounted' });
    return () => {
      recordProfileDiagnostic({
        event: 'mount',
        mountId,
        outcome: 'unmounted',
      });
    };
  }, [mountId]);

  useEffect(() => {
    recordProfileDiagnostic({
      event: 'effect',
      mountId,
      outcome: 'setup',
      dependency: 'load',
      currentSequence: loadSequence.current,
    });
    load();
    return () => {
      loadSequence.current += 1;
      recordProfileDiagnostic({
        event: 'effect',
        mountId,
        outcome: 'cleanup',
        dependency: 'load',
        currentSequence: loadSequence.current,
      });
    };
  }, [load, mountId]);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener?.('focus', () =>
      recordProfileDiagnostic({
        event: 'navigation',
        mountId,
        outcome: 'focus',
      }),
    );
    const unsubscribeBlur = navigation.addListener?.('blur', () =>
      recordProfileDiagnostic({
        event: 'navigation',
        mountId,
        outcome: 'blur',
      }),
    );
    return () => {
      unsubscribeFocus?.();
      unsubscribeBlur?.();
    };
  }, [mountId, navigation]);

  useEffect(() => {
    if (editor.cooldownUntil <= Date.now()) return undefined;
    const timer = setInterval(() => setProfileSaveNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [editor.cooldownUntil]);

  const diagnosticRenderBranch =
    state.error && !state.user && !state.card
      ? 'error_retry'
      : state.refreshing && !state.user && !state.card
      ? 'profile_shell'
      : state.source === 'cached'
      ? 'cached_profile'
      : 'loaded_profile';
  useEffect(() => {
    if (lastRenderBranch.current === diagnosticRenderBranch) return;
    lastRenderBranch.current = diagnosticRenderBranch;
    recordProfileDiagnostic({
      event: 'render',
      mountId,
      branch: diagnosticRenderBranch,
      loading: state.loading,
      error: state.error || 'none',
      source: state.source,
    });
  }, [
    diagnosticRenderBranch,
    mountId,
    state.error,
    state.loading,
    state.source,
  ]);

  const openEditor = () =>
    setEditor({
      visible: true,
      name: state.card?.values.name || '',
      professional_headline: state.card?.values.professional_headline || '',
      bio: state.card?.values.bio || '',
      base_state: state.card?.values.base_state || '',
      licensed_states: [...(state.card?.values.licensed_states || [])],
      specialties: [...(state.card?.values.specialties || [])],
      adjuster_type: state.card?.values.adjuster_type || '',
      years_experience: state.card?.values.years_experience || '',
      cat_experience: state.card?.values.cat_experience || '',
      cat_availability: state.card?.values.cat_availability || '',
      work_mode: state.card?.values.work_mode || '',
      travel_preference: state.card?.values.travel_preference || '',
      visibility: { ...(state.card?.visibility || {}) },
      photoAsset: null,
      photoPreviewUri: null,
      submitting: false,
      cooldownUntil: 0,
      error: null,
    });
  const saveProfile = async () => {
    if (!canStartProfileSave(editor.cooldownUntil)) return;
    setEditor(current => ({ ...current, submitting: true, error: null }));
    try {
      await runProfileSaveSequence({
        photoAsset: editor.photoAsset,
        uploadPhoto: asset => uploadProfilePhoto(site, state.card, asset),
        onPhotoUploaded: uploadedPhoto => {
          if (uploadedPhoto?.avatarTemplate) {
            authoritativeAvatar.current = uploadedPhoto.avatarTemplate;
            updateCachedMemberProfileAvatar(
              site,
              username,
              uploadedPhoto.avatarTemplate,
            );
            setState(current => ({
              ...current,
              user: current.user
                ? {
                    ...current.user,
                    avatar_template: uploadedPhoto.avatarTemplate,
                  }
                : current.user,
              card: current.card
                ? {
                    ...current.card,
                    avatarTemplate: uploadedPhoto.avatarTemplate,
                  }
                : current.card,
            }));
          }
          setEditor(current => ({
            ...current,
            photoAsset: null,
            photoPreviewUri: current.photoPreviewUri,
          }));
        },
        saveFields: () =>
          saveAdjusterCardFields(
            site,
            state.card,
            {
              name: editor.name.trim(),
              professional_headline: editor.professional_headline.trim(),
              bio: editor.bio.trim(),
              base_state: editor.base_state.trim().toUpperCase(),
              licensed_states: editor.licensed_states,
              specialties: editor.specialties,
              adjuster_type: editor.adjuster_type,
              years_experience: editor.years_experience,
              cat_experience: editor.cat_experience,
              cat_availability: editor.cat_availability,
              work_mode: editor.work_mode,
              travel_preference: editor.travel_preference,
            },
            editor.visibility,
          ),
      });
      setEditor(current => ({ ...current, visible: false, submitting: false }));
      load();
    } catch (error) {
      const cooldownMs = profileRetryAfterMs(error);
      setProfileSaveNow(Date.now());
      setEditor(current => ({
        ...current,
        submitting: false,
        cooldownUntil: cooldownMs > 0 ? Date.now() + cooldownMs : 0,
        error: profileSaveErrorMessage(error, cooldownMs),
      }));
    }
  };

  const choosePhoto = async () => {
    setEditor(current => ({ ...current, submitting: true, error: null }));
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
        return setEditor(current => ({ ...current, submitting: false }));
      }
      const asset = result.assets[0];
      const photoAsset = {
        uri: asset.uri,
        name: asset.fileName || 'profile-photo.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
        size: Number(asset.fileSize || 0),
      };
      setEditor(current => ({
        ...current,
        photoAsset,
        photoPreviewUri: asset.uri,
        submitting: false,
      }));
    } catch (error) {
      setEditor(current => ({
        ...current,
        submitting: false,
        error:
          error?.message === 'photo_permission_denied'
            ? 'Photo access was not granted.'
            : error?.userMessages?.join(' ') ||
              'Your profile photo could not be updated.',
      }));
    }
  };

  const removePhoto = () => {
    Alert.alert(
      'Remove profile photo?',
      'Your Adjuster Card will return to the default member avatar.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setEditor(current => ({
              ...current,
              submitting: true,
              error: null,
            }));
            try {
              await removeProfilePhoto(site, state.card);
              setEditor(current => ({
                ...current,
                photoAsset: null,
                photoPreviewUri: null,
                submitting: false,
              }));
              await load();
            } catch (error) {
              setEditor(current => ({
                ...current,
                submitting: false,
                error:
                  error?.userMessages?.join(' ') ||
                  'Your profile photo could not be removed.',
              }));
            }
          },
        },
      ],
    );
  };

  const chooseResume = async () => {
    setEditor(current => ({ ...current, submitting: true, error: null }));
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: state.card.resume.allowed_mime_types,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) {
        return setEditor(current => ({ ...current, submitting: false }));
      }
      const resumeMetadata = await uploadPrivateResume(
        site,
        state.card,
        result.assets[0],
      );
      setState(current => ({
        ...current,
        card: { ...current.card, resumeMetadata },
      }));
      setEditor(current => ({ ...current, submitting: false }));
    } catch (error) {
      setEditor(current => ({
        ...current,
        submitting: false,
        error:
          error?.userMessages?.join(' ') ||
          'Your private résumé could not be uploaded.',
      }));
    }
  };

  const removeResume = () => {
    Alert.alert(
      'Remove private résumé?',
      'This removes the stored file from your Adjuster Card.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setEditor(current => ({
              ...current,
              submitting: true,
              error: null,
            }));
            try {
              const card = await deletePrivateResume(site, state.card);
              setState(current => ({ ...current, card }));
              setEditor(current => ({ ...current, submitting: false }));
            } catch (error) {
              setEditor(current => ({
                ...current,
                submitting: false,
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

  const user = state.user || {
    username,
    avatar_template: state.card?.avatarTemplate,
  };
  const cooldownSeconds = profileCooldownSeconds(
    editor.cooldownUntil,
    profileSaveNow,
  );
  const card = state.card;
  const canEdit = card?.editable === true && user?.username === site?.username;
  const editableFields = [
    ...editableFieldsForStep(card, 'profile'),
    ...editableFieldsForStep(card, 'licenses'),
    ...editableFieldsForStep(card, 'experience'),
  ];
  const canSetVisibility = field => {
    const options = card?.capabilities?.[field]?.visibilityOptions || [];
    return options.includes('members') && options.includes('self');
  };
  const renderVisibility = field =>
    canSetVisibility(field) ? (
      <View style={styles.visibilityRow}>
        <Text style={[styles.visibilityLabel, { color: colors.muted }]}>
          Visibility
        </Text>
        {[
          ['members', 'users'],
          ['self', 'lock'],
        ].map(([value, icon]) => {
          const selected = (editor.visibility[field] || 'self') === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`${
                FIELD_LABELS[field]
              } visibility: ${visibilityLabel(value)}`}
              accessibilityState={{ checked: selected }}
              disabled={editor.submitting}
              onPress={() =>
                setEditor(current => ({
                  ...current,
                  visibility: { ...current.visibility, [field]: value },
                }))
              }
              style={[
                styles.visibilityChoice,
                {
                  backgroundColor: selected ? colors.accentSoft : colors.canvas,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <FontAwesome5
                name={icon}
                size={12}
                color={selected ? colors.accent : colors.muted}
                iconStyle="solid"
              />
              <Text
                style={[
                  styles.visibilityChoiceText,
                  { color: selected ? colors.accent : colors.muted },
                ]}
              >
                {visibilityLabel(value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ) : null;
  const renderTextField = (field, options = {}) =>
    editableFields.includes(field) ? (
      <View key={field} style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>
          {FIELD_LABELS[field]}
        </Text>
        <TextInput
          accessibilityLabel={FIELD_LABELS[field]}
          editable={!editor.submitting}
          multiline={options.multiline === true}
          onChangeText={value =>
            setEditor(current => ({ ...current, [field]: value, error: null }))
          }
          placeholder={options.placeholder}
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            options.multiline && styles.bioInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          textAlignVertical={options.multiline ? 'top' : 'center'}
          value={editor[field]}
        />
        {renderVisibility(field)}
      </View>
    ) : null;
  const renderTokenField = field => {
    if (!editableFields.includes(field)) return null;
    const values = editor[field] || [];
    const display = value =>
      field === 'licensed_states' ? value : optionLabel('specialties', value);
    return (
      <View key={field} style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>
          {FIELD_LABELS[field]}
        </Text>
        <View style={styles.valueChips}>
          {values.map(value => (
            <View
              key={value}
              style={[styles.valueChip, { backgroundColor: colors.accentSoft }]}
            >
              <Text style={[styles.valueChipText, { color: colors.accent }]}>
                {display(value)}
              </Text>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${FIELD_LABELS[field].toLowerCase()}`}
            disabled={editor.submitting}
            onPress={() => setSelectionField(field)}
            style={[styles.addChoice, { borderColor: colors.border }]}
          >
            <FontAwesome5
              name="plus"
              size={12}
              color={colors.accent}
              iconStyle="solid"
            />
            <Text style={[styles.addChoiceText, { color: colors.accent }]}>
              {values.length ? 'Edit' : 'Add'}
            </Text>
          </Pressable>
        </View>
        {renderVisibility(field)}
      </View>
    );
  };
  const renderOptionField = (field, options) =>
    editableFields.includes(field) ? (
      <View key={field} style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>
          {FIELD_LABELS[field]}
        </Text>
        <View style={styles.optionRow}>
          {options.map(([value, label]) => {
            const selected = editor[field] === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                disabled={editor.submitting}
                onPress={() =>
                  setEditor(current => ({
                    ...current,
                    [field]: value,
                    error: null,
                  }))
                }
                style={[
                  styles.option,
                  {
                    backgroundColor: selected
                      ? colors.accentSoft
                      : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {renderVisibility(field)}
      </View>
    ) : null;
  const selectionChoices =
    selectionField === 'specialties' ? SPECIALTY_OPTIONS : US_STATES;
  const selectionIsMultiple =
    selectionField === 'licensed_states' || selectionField === 'specialties';
  const selectionContains = value =>
    selectionIsMultiple
      ? (editor[selectionField] || []).includes(value)
      : editor[selectionField] === value;
  const updateSelection = value => {
    if (!selectionIsMultiple) {
      setEditor(current => ({ ...current, [selectionField]: value }));
      setSelectionField(null);
      return;
    }
    setEditor(current => {
      const present = (current[selectionField] || []).includes(value);
      return {
        ...current,
        [selectionField]: present
          ? current[selectionField].filter(item => item !== value)
          : [...current[selectionField], value],
      };
    });
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <NestedHeader title="Member profile" onBack={() => navigation.goBack()} />
      {state.error && !state.user && !state.card ? (
        <View style={styles.content}>
          <InlineState
            icon="user"
            title="Couldn’t refresh this member"
            body="The member profile is temporarily unavailable. Try again without leaving the Network."
            action={<Action label="Try again" secondary onPress={load} />}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {state.refreshing ? (
            <Text style={[styles.refreshing, { color: colors.muted }]}>
              {state.user || state.card
                ? 'Refreshing…'
                : 'Waiting briefly for member details…'}
            </Text>
          ) : null}
          {state.error ? (
            <InlineState
              icon="sync"
              title="Profile refresh paused"
              body="Your last profile remains available. Try refreshing when the connection is ready."
              action={<Action label="Try again" secondary onPress={load} />}
            />
          ) : null}
          <View
            style={[
              styles.profile,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {avatarUrl(site, user?.avatar_template) ? (
              <Image
                accessibilityLabel={`${
                  card?.values.name || username
                } profile photo`}
                source={{ uri: avatarUrl(site, user.avatar_template) }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={styles.avatarText}>
                  {String(user?.username || username)
                    .slice(0, 1)
                    .toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.profileCopy}>
              <Text
                accessibilityRole="header"
                style={[styles.heading, { color: colors.text }]}
              >
                {card?.values.name || user?.username || username}
              </Text>
              <Text style={[styles.handle, { color: colors.muted }]}>
                @{user?.username || username}
              </Text>
            </View>
          </View>
          {card?.values.professional_headline ? (
            <Text style={[styles.headline, { color: colors.accent }]}>
              {card.values.professional_headline}
            </Text>
          ) : null}
          {plainText(card?.values.bio) ? (
            <Text style={[styles.bio, { color: colors.text }]}>
              {plainText(card.values.bio)}
            </Text>
          ) : (
            <Text style={[styles.bio, { color: colors.muted }]}>
              This member has not added a bio.
            </Text>
          )}
          {card?.values.base_state || card?.values.licensed_states?.length ? (
            <View style={styles.profileSection}>
              <Text style={[styles.profileEyebrow, { color: colors.muted }]}>
                AT A GLANCE
              </Text>
              {card?.values.base_state ? (
                <Text style={[styles.profileFact, { color: colors.text }]}>
                  Based in {stateLabel(card.values.base_state)}
                </Text>
              ) : null}
              {card?.values.licensed_states?.length ? (
                <View style={styles.valueChips}>
                  {card.values.licensed_states.map(value => (
                    <View
                      key={value}
                      style={[
                        styles.valueChip,
                        { backgroundColor: colors.accentSoft },
                      ]}
                    >
                      <Text
                        style={[styles.valueChipText, { color: colors.accent }]}
                      >
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          {card?.values.specialties?.length ||
          card?.values.adjuster_type ||
          card?.values.years_experience ||
          card?.values.cat_experience ||
          card?.values.work_mode ? (
            <View style={styles.profileSection}>
              <Text style={[styles.profileEyebrow, { color: colors.muted }]}>
                EXPERIENCE
              </Text>
              {card?.values.specialties?.length ? (
                <View style={styles.valueChips}>
                  {card.values.specialties.map(value => (
                    <View
                      key={value}
                      style={[
                        styles.valueChip,
                        { backgroundColor: colors.surfaceAlt },
                      ]}
                    >
                      <Text
                        style={[styles.valueChipText, { color: colors.text }]}
                      >
                        {optionLabel('specialties', value)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {[
                ['adjuster_type', card?.values.adjuster_type],
                ['years_experience', card?.values.years_experience],
                ['cat_experience', card?.values.cat_experience],
                ['work_mode', card?.values.work_mode],
              ]
                .filter(([, value]) => value)
                .map(([field, value]) => (
                  <Text
                    key={field}
                    style={[styles.profileFact, { color: colors.text }]}
                  >
                    {FIELD_LABELS[field]}: {optionLabel(field, value)}
                  </Text>
                ))}
            </View>
          ) : null}
          {canEdit ? (
            <View style={styles.edit}>
              <Action
                label="Edit profile"
                secondary
                icon="pen"
                onPress={openEditor}
              />
            </View>
          ) : null}
          <Text
            accessibilityRole="header"
            style={[styles.section, { color: colors.text }]}
          >
            Recent contributions
          </Text>
          {state.actions.length ? (
            state.actions.slice(0, 20).map(action => (
              <View
                key={action.id}
                style={[styles.actionRow, { borderColor: colors.border }]}
              >
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  {action.title || 'Member contribution'}
                </Text>
                <Text style={[styles.detail, { color: colors.muted }]}>
                  {action.excerpt || action.action_type_name || ''}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.bio, { color: colors.muted }]}>
              No recent contributions are available.
            </Text>
          )}
        </ScrollView>
      )}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={editor.visible}
        onRequestClose={() =>
          !editor.submitting &&
          setEditor(current => ({ ...current, visible: false }))
        }
      >
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.safe}
          >
            <NestedHeader
              title="Edit profile"
              onBack={() =>
                !editor.submitting &&
                setEditor(current => ({ ...current, visible: false }))
              }
            />
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              {card?.photo.enabled ? (
                <View
                  style={[
                    styles.photoEditor,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {editor.photoPreviewUri ||
                  avatarUrl(site, card.avatarTemplate) ? (
                    <Image
                      accessibilityLabel="Current profile photo"
                      source={{
                        uri:
                          editor.photoPreviewUri ||
                          avatarUrl(site, card.avatarTemplate),
                      }}
                      style={styles.photoEditorAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.photoEditorAvatar,
                        styles.photoFallback,
                        { backgroundColor: colors.accentSoft },
                      ]}
                    >
                      <FontAwesome5
                        name="user"
                        size={28}
                        color={colors.accent}
                        iconStyle="solid"
                      />
                    </View>
                  )}
                  <View style={styles.photoActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Change profile photo"
                      disabled={editor.submitting || !card.photo.editable}
                      onPress={choosePhoto}
                      style={styles.compactAction}
                    >
                      <Text
                        style={[
                          styles.compactActionText,
                          { color: colors.accent },
                        ]}
                      >
                        Change photo
                      </Text>
                    </Pressable>
                    {card.avatarTemplate ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove profile photo"
                        disabled={editor.submitting || !card.photo.editable}
                        onPress={removePhoto}
                        style={styles.compactAction}
                      >
                        <Text
                          style={[
                            styles.compactActionText,
                            { color: colors.danger },
                          ]}
                        >
                          Remove photo
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {renderTextField('name', { placeholder: 'How members know you' })}
              {renderTextField('professional_headline', {
                placeholder: 'Your role or focus',
              })}
              {editableFields.includes('base_state') ? (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>
                    Base state
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Base state: ${
                      stateLabel(editor.base_state) || 'Not selected'
                    }`}
                    onPress={() => setSelectionField('base_state')}
                    style={[
                      styles.selector,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectorText,
                        {
                          color: editor.base_state ? colors.text : colors.muted,
                        },
                      ]}
                    >
                      {stateLabel(editor.base_state) ||
                        'Select your base state'}
                    </Text>
                    <FontAwesome5
                      name="chevron-down"
                      size={13}
                      color={colors.muted}
                      iconStyle="solid"
                    />
                  </Pressable>
                  {renderVisibility('base_state')}
                </View>
              ) : null}
              {renderTokenField('licensed_states')}
              {renderTextField('bio', {
                multiline: true,
                placeholder: 'Share your professional background',
              })}
              {Object.entries(FIELD_OPTIONS).map(([field, options]) =>
                renderOptionField(field, options),
              )}
              {renderTokenField('specialties')}
              {card?.resume.enabled ? (
                <View style={styles.mediaAction}>
                  <Text style={[styles.detail, { color: colors.muted }]}>
                    Résumé files remain private, owner-only, non-public, and
                    excluded from recruiter search.
                  </Text>
                  <Action
                    disabled={editor.submitting || !card.resume.upload}
                    label={
                      card.resumeMetadata.state === 'available'
                        ? 'Replace résumé'
                        : 'Upload résumé'
                    }
                    onPress={chooseResume}
                    secondary
                  />
                  {card.resumeMetadata.state === 'available' &&
                  card.resume.delete ? (
                    <Action
                      disabled={editor.submitting}
                      label="Remove résumé"
                      onPress={removeResume}
                      secondary
                    />
                  ) : null}
                </View>
              ) : null}
              {editor.error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.danger }}
                >
                  {editor.error}
                </Text>
              ) : null}
              <View style={styles.edit}>
                {cooldownSeconds > 0 ? (
                  <ProfileSaveCooldownControl
                    colors={colors}
                    seconds={cooldownSeconds}
                  />
                ) : (
                  <Action
                    label={editor.submitting ? 'Saving…' : 'Save profile'}
                    disabled={editor.submitting}
                    onPress={saveProfile}
                  />
                )}
              </View>
            </ScrollView>
            <Modal
              animationType="slide"
              presentationStyle="pageSheet"
              visible={selectionField != null}
              onRequestClose={() => setSelectionField(null)}
            >
              <SafeAreaView
                style={[styles.safe, { backgroundColor: colors.canvas }]}
              >
                <NestedHeader
                  title={FIELD_LABELS[selectionField] || 'Choose'}
                  onBack={() => setSelectionField(null)}
                />
                <ScrollView contentContainerStyle={styles.selectionContent}>
                  {selectionChoices.map(([value, label]) => {
                    const selected = selectionContains(value);
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole={
                          selectionIsMultiple ? 'checkbox' : 'radio'
                        }
                        accessibilityState={
                          selectionIsMultiple
                            ? { checked: selected }
                            : { checked: selected }
                        }
                        onPress={() => updateSelection(value)}
                        style={[
                          styles.selectionRow,
                          { borderBottomColor: colors.border },
                        ]}
                      >
                        <View>
                          <Text
                            style={[
                              styles.selectionName,
                              { color: colors.text },
                            ]}
                          >
                            {label}
                          </Text>
                          {selectionField !== 'specialties' ? (
                            <Text
                              style={[
                                styles.selectionCode,
                                { color: colors.muted },
                              ]}
                            >
                              {value}
                            </Text>
                          ) : null}
                        </View>
                        {selected ? (
                          <FontAwesome5
                            name="check"
                            size={15}
                            color={colors.accent}
                            iconStyle="solid"
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {selectionIsMultiple ? (
                    <View style={styles.selectionDone}>
                      <Action
                        label="Done"
                        onPress={() => setSelectionField(null)}
                      />
                    </View>
                  ) : null}
                </ScrollView>
              </SafeAreaView>
            </Modal>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  status: { fontSize: 15 },
  heading: { fontSize: 23, lineHeight: 30, fontWeight: '800' },
  profile: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 3,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileCopy: { flex: 1 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  handle: { fontSize: 14, marginTop: 2 },
  headline: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  bio: { fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  detail: { fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  profileSection: { marginTop: spacing.lg, gap: spacing.sm },
  profileEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  profileFact: { fontSize: 15, lineHeight: 21, fontWeight: '550' },
  refreshing: { fontSize: 13, lineHeight: 18, fontWeight: '650' },
  valueChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  valueChip: {
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  valueChipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  edit: { alignItems: 'flex-start', marginTop: spacing.md },
  section: {
    fontSize: 19,
    fontWeight: '750',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  actionTitle: { fontSize: 15, fontWeight: '700' },
  input: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
  },
  bioInput: { minHeight: 116 },
  fieldGroup: { marginBottom: spacing.lg, gap: spacing.xs },
  fieldLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  selector: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: { fontSize: 16, lineHeight: 22 },
  addChoice: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  addChoiceText: { fontSize: 13, fontWeight: '700' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  optionText: { fontSize: 14, fontWeight: '650' },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  visibilityLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '650',
    marginRight: spacing.xs,
  },
  visibilityChoice: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  visibilityChoiceText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  photoEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  photoEditorAvatar: { width: 72, height: 72, borderRadius: 36 },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  photoActions: { flex: 1, alignItems: 'flex-start', gap: spacing.sm },
  compactAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  compactActionText: { fontSize: 14, lineHeight: 19, fontWeight: '750' },
  mediaAction: { gap: spacing.sm, marginBottom: spacing.md },
  selectionContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  selectionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  selectionName: { fontSize: 16, lineHeight: 21, fontWeight: '650' },
  selectionCode: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  selectionDone: { alignItems: 'flex-start', marginTop: spacing.lg },
});
