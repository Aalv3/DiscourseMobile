/* @flow */
'use strict';

import React, { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome5 from '@react-native-vector-icons/fontawesome5';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { radius, spacing, type } from './DesignSystem';
import { useProductTheme } from './ProductComponents';
import { adjusterNetwork } from '../adjusterNetworkConfig';
import {
  attachmentIsImage,
  mediaPrivacyReminder,
  normalizePickerAsset,
  uploadAttachment,
  uploadErrorMessage,
} from './MediaAttachments';

const permissionAlert = kind =>
  Alert.alert(
    `${kind} access is off`,
    `Allow Adjuster Network to use ${kind.toLowerCase()} access in Settings, then try again.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );

export function useAttachmentQueue(site, uploadType = 'composer') {
  const [attachments, setAttachments] = useState([]);
  const enabled = adjusterNetwork.features.mediaUploads === true;

  const addAssets = useCallback(assets => {
    const additions = (assets || [])
      .filter(asset => asset?.uri)
      .map(normalizePickerAsset);
    if (additions.length) setAttachments(current => [...current, ...additions]);
  }, []);

  const choosePhotos = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      permissionAlert('Photo library');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.88,
      exif: false,
    });
    if (!result.canceled) addAssets(result.assets);
  }, [addAssets]);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      permissionAlert('Camera');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.88,
      exif: false,
    });
    if (!result.canceled) addAssets(result.assets);
  }, [addAssets]);

  const chooseFiles = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled) addAssets(result.assets);
  }, [addAssets]);

  const chooseSource = useCallback(() => {
    if (!enabled) return;
    const options = ['Take Photo', 'Choose Photo(s)', 'Choose File', 'Cancel'];
    const select = index => {
      if (index === 0) takePhoto();
      if (index === 1) choosePhotos();
      if (index === 2) chooseFiles();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 3, title: 'Add an attachment' },
        select,
      );
    } else {
      Alert.alert('Add an attachment', undefined, [
        { text: options[0], onPress: () => select(0) },
        { text: options[1], onPress: () => select(1) },
        { text: options[2], onPress: () => select(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [chooseFiles, choosePhotos, enabled, takePhoto]);

  const remove = useCallback(localId => {
    setAttachments(current => current.filter(item => item.localId !== localId));
  }, []);

  const uploadOne = useCallback(
    async localId => {
      if (!enabled) throw new Error('media_uploads_disabled');
      const target = attachments.find(item => item.localId === localId);
      if (!target || target.status === 'succeeded') return target;
      setAttachments(current =>
        current.map(item =>
          item.localId === localId
            ? { ...item, status: 'uploading', error: null }
            : item,
        ),
      );
      try {
        const upload = await uploadAttachment(site, target, uploadType);
        const completed = {
          ...target,
          status: 'succeeded',
          upload,
          error: null,
        };
        setAttachments(current =>
          current.map(item => (item.localId === localId ? completed : item)),
        );
        return completed;
      } catch (error) {
        const failed = {
          ...target,
          status: 'failed',
          error: uploadErrorMessage(error),
        };
        setAttachments(current =>
          current.map(item => (item.localId === localId ? failed : item)),
        );
        throw error;
      }
    },
    [attachments, enabled, site, uploadType],
  );

  const uploadAll = useCallback(async () => {
    const completed = [];
    for (const attachment of attachments) {
      if (attachment.status === 'succeeded') {
        completed.push(attachment);
      } else {
        completed.push(await uploadOne(attachment.localId));
      }
    }
    return completed;
  }, [attachments, uploadOne]);

  const clear = useCallback(() => setAttachments([]), []);
  return {
    attachments,
    chooseSource,
    remove,
    uploadOne,
    uploadAll,
    clear,
    enabled,
  };
}

export default function AttachmentComposer({ queue, disabled = false }) {
  const colors = useProductTheme();
  if (!queue.enabled) {
    return (
      <View
        accessibilityLabel="Photo and file attachments are not available yet"
        style={[
          styles.unavailable,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}
      >
        <FontAwesome5
          name="paperclip"
          size={14}
          color={colors.muted}
          iconStyle="solid"
        />
        <Text style={[styles.unavailableText, { color: colors.muted }]}>
          Photo and file attachments are not available yet.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add photo or file"
        disabled={disabled}
        onPress={queue.chooseSource}
        style={({ pressed }) => [
          styles.attachButton,
          {
            borderColor: colors.border,
            opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <FontAwesome5
          name="paperclip"
          size={15}
          color={colors.accent}
          iconStyle="solid"
        />
        <Text style={[styles.attachLabel, { color: colors.accent }]}>
          Add photo or file
        </Text>
      </Pressable>
      {queue.attachments.length ? (
        <View style={styles.queue}>
          {queue.attachments.map(item => (
            <View
              key={item.localId}
              style={[styles.item, { borderColor: colors.border }]}
            >
              {attachmentIsImage(item) ? (
                <Image
                  accessibilityLabel={`Selected image ${item.name}`}
                  source={{ uri: item.uri }}
                  style={styles.preview}
                />
              ) : (
                <View
                  style={[
                    styles.preview,
                    styles.filePreview,
                    { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <FontAwesome5
                    name="file-alt"
                    size={18}
                    color={colors.accent}
                    iconStyle="solid"
                  />
                </View>
              )}
              <View style={styles.copy}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: colors.text }]}
                >
                  {item.name}
                </Text>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.status,
                    {
                      color:
                        item.status === 'failed' ? colors.danger : colors.muted,
                    },
                  ]}
                >
                  {item.status === 'queued'
                    ? 'Ready to upload'
                    : item.status === 'uploading'
                    ? 'Uploading…'
                    : item.status === 'succeeded'
                    ? 'Uploaded'
                    : item.error}
                </Text>
              </View>
              {item.status === 'failed' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Retry ${item.name}`}
                  hitSlop={8}
                  onPress={() => queue.uploadOne(item.localId).catch(() => {})}
                >
                  <FontAwesome5
                    name="redo"
                    size={15}
                    color={colors.accent}
                    iconStyle="solid"
                  />
                </Pressable>
              ) : null}
              {item.status !== 'uploading' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                  hitSlop={8}
                  onPress={() => queue.remove(item.localId)}
                >
                  <FontAwesome5
                    name="times"
                    size={16}
                    color={colors.muted}
                    iconStyle="solid"
                  />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {queue.attachments.length ? (
        <Text style={[styles.reminder, { color: colors.muted }]}>
          {mediaPrivacyReminder}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  unavailable: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
  },
  unavailableText: { ...type.metadata, flexShrink: 1 },
  attachButton: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
  },
  attachLabel: { fontSize: 14, fontWeight: '750' },
  queue: { gap: spacing.xs },
  item: {
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: { width: 46, height: 46, borderRadius: radius.sm },
  filePreview: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  name: { ...type.metadata, fontWeight: '750' },
  status: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  reminder: { ...type.metadata },
});
