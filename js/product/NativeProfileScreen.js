/* @flow */
'use strict';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { decode } from 'html-entities';
import { activeMemberSite } from './ProductData';
import { Action, NestedHeader, useProductTheme } from './ProductComponents';
import { radius, spacing } from './DesignSystem';
import EmojiTextInput from './EmojiTextInput';

const plainText = value =>
  decode(
    String(value || '')
      .replace(/<[^>]+>/g, '')
      .trim(),
  );

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
    actions: [],
    error: null,
  });
  const [editor, setEditor] = useState({
    visible: false,
    name: '',
    location: '',
    website: '',
    bio_raw: '',
    submitting: false,
    error: null,
  });

  const load = useCallback(async () => {
    if (!site?.authToken)
      return setState({
        loading: false,
        user: null,
        actions: [],
        error: 'signed_out',
      });
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const [profile, activity] = await Promise.all([
        site.jsonApi(`/u/${encodeURIComponent(username)}.json`),
        site
          .jsonApi(
            `/user_actions.json?username=${encodeURIComponent(
              username,
            )}&filter=4,5`,
          )
          .catch(() => ({ user_actions: [] })),
      ]);
      setState({
        loading: false,
        user: profile?.user || profile,
        actions: activity?.user_actions || [],
        error: null,
      });
    } catch {
      setState({ loading: false, user: null, actions: [], error: 'failed' });
    }
  }, [site, username]);

  useEffect(() => {
    load();
  }, [load]);

  const openEditor = () =>
    setEditor({
      visible: true,
      name: state.user?.name || '',
      location: state.user?.location || '',
      website: state.user?.website || '',
      bio_raw: state.user?.bio_raw || plainText(state.user?.bio_cooked),
      submitting: false,
      error: null,
    });
  const saveProfile = async () => {
    setEditor(current => ({ ...current, submitting: true, error: null }));
    try {
      await site.jsonApi(`/u/${encodeURIComponent(username)}.json`, 'PUT', {
        name: editor.name.trim(),
        location: editor.location.trim(),
        website: editor.website.trim(),
        bio_raw: editor.bio_raw.trim(),
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

  const user = state.user;
  const canEdit = user?.can_edit === true && user?.username === site?.username;
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
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.avatarText}>
                {String(user?.username || username)
                  .slice(0, 1)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileCopy}>
              <Text
                accessibilityRole="header"
                style={[styles.heading, { color: colors.text }]}
              >
                {user?.name || user?.username || username}
              </Text>
              <Text style={[styles.handle, { color: colors.muted }]}>
                @{user?.username || username}
              </Text>
            </View>
          </View>
          {plainText(user?.bio_cooked || user?.bio_raw) ? (
            <Text style={[styles.bio, { color: colors.text }]}>
              {plainText(user?.bio_cooked || user?.bio_raw)}
            </Text>
          ) : (
            <Text style={[styles.bio, { color: colors.muted }]}>
              This member has not added a bio.
            </Text>
          )}
          {[user?.location, user?.website].filter(Boolean).map(value => (
            <Text key={value} style={[styles.detail, { color: colors.muted }]}>
              {value}
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
                ['Location', 'location'],
              ].map(([label, field]) => (
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
              <TextInput
                accessibilityLabel="Website"
                editable={!editor.submitting}
                placeholder="Website"
                placeholderTextColor={colors.muted}
                value={editor.website}
                onChangeText={website =>
                  setEditor(current => ({ ...current, website, error: null }))
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
              <EmojiTextInput
                accessibilityLabel="Bio"
                editable={!editor.submitting}
                multiline
                placeholder="About you"
                placeholderTextColor={colors.muted}
                value={editor.bio_raw}
                onChangeText={bio_raw =>
                  setEditor(current => ({ ...current, bio_raw, error: null }))
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
});
