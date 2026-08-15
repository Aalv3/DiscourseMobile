/* @flow */
'use strict';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'html-entities';
import { activeMemberSite } from './ProductData';
import { availableContributionActions } from '../memberContentAvailability';
import { Action, NestedHeader, useProductTheme } from './ProductComponents';
import { radius, spacing } from './DesignSystem';
import EmojiTextInput from './EmojiTextInput';
import {
  deletePrivateResume,
  editableFieldsForStep,
  FIELD_OPTIONS,
  parseAdjusterCard,
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
  const [state, setState] = useState({
    loading: true,
    user: null,
    card: null,
    actions: [],
    error: null,
  });
  const [editor, setEditor] = useState({
    visible: false,
    name: '',
    professional_headline: '',
    bio: '',
    licensed_states: '',
    specialties: '',
    adjuster_type: '',
    years_experience: '',
    cat_experience: '',
    cat_availability: '',
    work_mode: '',
    travel_preference: '',
    submitting: false,
    error: null,
  });

  const load = useCallback(async () => {
    if (!site?.authToken)
      return setState({
        loading: false,
        user: null,
        card: null,
        actions: [],
        error: 'signed_out',
      });
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const [profile, activity, cardPayload] = await Promise.all([
        site.jsonApi(`/u/${encodeURIComponent(username)}.json`),
        site
          .jsonApi(
            `/user_actions.json?username=${encodeURIComponent(
              username,
            )}&filter=4,5`,
          )
          .catch(() => ({ user_actions: [] })),
        site.jsonApi(
          username === site.username
            ? '/native/v1/profile'
            : `/native/v1/profile/${encodeURIComponent(username)}`,
        ),
      ]);
      const actions = await availableContributionActions(
        site,
        activity?.user_actions || [],
      );
      setState({
        loading: false,
        user: profile?.user || profile,
        card: parseAdjusterCard(cardPayload),
        actions,
        error: null,
      });
    } catch {
      setState({
        loading: false,
        user: null,
        card: null,
        actions: [],
        error: 'failed',
      });
    }
  }, [site, username]);

  useEffect(() => {
    load();
  }, [load]);

  const openEditor = () =>
    setEditor({
      visible: true,
      name: state.card?.values.name || '',
      professional_headline: state.card?.values.professional_headline || '',
      bio: state.card?.values.bio || '',
      licensed_states: (state.card?.values.licensed_states || []).join(', '),
      specialties: (state.card?.values.specialties || []).join(', '),
      adjuster_type: state.card?.values.adjuster_type || '',
      years_experience: state.card?.values.years_experience || '',
      cat_experience: state.card?.values.cat_experience || '',
      cat_availability: state.card?.values.cat_availability || '',
      work_mode: state.card?.values.work_mode || '',
      travel_preference: state.card?.values.travel_preference || '',
      submitting: false,
      error: null,
    });
  const saveProfile = async () => {
    setEditor(current => ({ ...current, submitting: true, error: null }));
    try {
      await saveAdjusterCardFields(site, state.card, {
        name: editor.name.trim(),
        professional_headline: editor.professional_headline.trim(),
        bio: editor.bio.trim(),
        licensed_states: editor.licensed_states
          .split(',')
          .map(value => value.trim().toUpperCase())
          .filter(Boolean),
        specialties: editor.specialties
          .split(',')
          .map(value =>
            value
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9_-]+/g, '_'),
          )
          .filter(Boolean),
        adjuster_type: editor.adjuster_type,
        years_experience: editor.years_experience,
        cat_experience: editor.cat_experience,
        cat_availability: editor.cat_availability,
        work_mode: editor.work_mode,
        travel_preference: editor.travel_preference,
      });
      setEditor(current => ({ ...current, visible: false, submitting: false }));
      await load();
    } catch (error) {
      setEditor(current => ({
        ...current,
        submitting: false,
        error:
          error?.userMessages?.join(' ') ||
          'Profile changes could not be saved.',
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
      await uploadProfilePhoto(site, state.card, {
        uri: asset.uri,
        name: asset.fileName || 'profile-photo.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
      });
      setEditor(current => ({ ...current, visible: false, submitting: false }));
      await load();
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

  const user = state.user;
  const card = state.card;
  const canEdit = card?.editable === true && user?.username === site?.username;
  const editableFields = [
    ...editableFieldsForStep(card, 'profile'),
    ...editableFieldsForStep(card, 'licenses'),
    ...editableFieldsForStep(card, 'experience'),
  ];
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <NestedHeader title="Member profile" onBack={() => navigation.goBack()} />
      {state.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.status, { color: colors.muted }]}>
            Loading profile…
          </Text>
        </View>
      ) : state.error ? (
        <View style={styles.center}>
          <Text
            accessibilityRole="header"
            style={[styles.heading, { color: colors.text }]}
          >
            Profile unavailable
          </Text>
          <Action label="Try again" secondary onPress={load} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
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
          {Array.isArray(card?.values.licensed_states) &&
          card.values.licensed_states.length ? (
            <Text style={[styles.detail, { color: colors.muted }]}>
              Licensed: {card.values.licensed_states.join(', ')}
            </Text>
          ) : null}
          {Array.isArray(card?.values.specialties) &&
          card.values.specialties.length ? (
            <Text style={[styles.detail, { color: colors.muted }]}>
              Specialties: {card.values.specialties.join(', ')}
            </Text>
          ) : null}
          {[card?.values.adjuster_type, card?.values.years_experience]
            .filter(Boolean)
            .map(value => (
              <Text
                key={value}
                style={[styles.detail, { color: colors.muted }]}
              >
                {String(value).replaceAll('_', ' ')}
              </Text>
            ))}
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
              {[
                ['Name', 'name'],
                ['Professional headline', 'professional_headline'],
                ['Licensed states', 'licensed_states'],
                ['Specialties', 'specialties'],
              ]
                .filter(([, field]) => editableFields.includes(field))
                .map(([label, field]) => (
                  <EmojiTextInput
                    key={field}
                    accessibilityLabel={label}
                    editable={!editor.submitting}
                    placeholder={label}
                    placeholderTextColor={colors.muted}
                    value={editor[field]}
                    onChangeText={value =>
                      setEditor(current => ({
                        ...current,
                        [field]: value,
                        error: null,
                      }))
                    }
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                  />
                ))}
              {editableFields.includes('bio') ? (
                <EmojiTextInput
                  accessibilityLabel="Bio"
                  editable={!editor.submitting}
                  multiline
                  placeholder="About you"
                  placeholderTextColor={colors.muted}
                  value={editor.bio}
                  onChangeText={bio =>
                    setEditor(current => ({ ...current, bio, error: null }))
                  }
                  style={[
                    styles.input,
                    styles.bioInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  textAlignVertical="top"
                />
              ) : null}
              {Object.entries(FIELD_OPTIONS)
                .filter(([field]) => editableFields.includes(field))
                .map(([field, options]) => (
                  <View key={field} style={styles.optionGroup}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>
                      {field.replaceAll('_', ' ')}
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
                                borderColor: selected
                                  ? colors.accent
                                  : colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.optionText,
                                { color: colors.text },
                              ]}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              {card?.photo.enabled ? (
                <View style={styles.mediaAction}>
                  <Action
                    disabled={editor.submitting || !card.photo.editable}
                    label="Choose profile photo"
                    onPress={choosePhoto}
                    secondary
                  />
                </View>
              ) : null}
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
                <Action
                  label={editor.submitting ? 'Saving…' : 'Save profile'}
                  disabled={editor.submitting}
                  onPress={saveProfile}
                />
              </View>
            </ScrollView>
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
    borderRadius: radius.md,
    padding: spacing.md,
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
  edit: { alignItems: 'flex-start', marginTop: spacing.md },
  section: {
    fontSize: 19,
    fontWeight: '750',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
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
    marginBottom: spacing.sm,
  },
  bioInput: { minHeight: 150 },
  optionGroup: { marginBottom: spacing.md },
  optionLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
    marginBottom: spacing.xs,
  },
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
  mediaAction: { gap: spacing.sm, marginBottom: spacing.md },
});
