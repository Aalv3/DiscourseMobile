/* @flow */
'use strict';

const DEFAULT_COOLDOWN_MS = 30000;
const MAX_COOLDOWN_MS = 5 * 60 * 1000;
const PHOTO_MIME_BY_EXTENSION = Object.freeze({
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
});
const PHOTO_EXTENSION_BY_MIME = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});

export function normalizeProfilePhotoPickerAsset(asset) {
  const uri = String(asset?.uri || '');
  if (!uri) throw new Error('invalid_upload_asset');
  const suppliedName = String(asset?.fileName || asset?.name || '');
  const extension = (suppliedName || uri)
    .split(/[?#]/, 1)[0]
    .match(/\.([a-z0-9]+)$/i)?.[1]
    ?.toLowerCase();
  const suppliedMime = String(asset?.mimeType || '').toLowerCase();
  const mimeType = suppliedMime || PHOTO_MIME_BY_EXTENSION[extension];
  const outputExtension = PHOTO_EXTENSION_BY_MIME[mimeType];
  if (!outputExtension) throw new Error('unsupported_profile_photo_type');
  return {
    uri,
    name: suppliedName || `profile-photo.${outputExtension}`,
    mimeType,
    size: Number(asset?.fileSize || asset?.size || 0),
  };
}

export function profileCooldownSeconds(until, now = Date.now()) {
  return Math.max(0, Math.ceil((Number(until) - now) / 1000));
}

export function canStartProfileSave(cooldownUntil, now = Date.now()) {
  return profileCooldownSeconds(cooldownUntil, now) === 0;
}

export function profileRetryAfterMs(error) {
  const directed = Number(error?.retryAfterMs);
  if (Number.isFinite(directed) && directed > 0) {
    return Math.min(directed, MAX_COOLDOWN_MS);
  }
  const messages = Array.isArray(error?.userMessages) ? error.userMessages : [];
  const match = messages.join(' ').match(/wait\s+(\d+)\s+seconds?/i);
  if (match) {
    return Math.min(Number(match[1]) * 1000, MAX_COOLDOWN_MS);
  }
  return error?.status === 429 ? DEFAULT_COOLDOWN_MS : 0;
}

export function profileSaveErrorMessage(error, cooldownMs) {
  if (error?.message === 'invalid_upload_asset') {
    return 'Your profile photo could not be prepared.';
  }
  if (error?.message === 'unsupported_profile_photo_type') {
    return 'Choose a JPEG, PNG, or WebP profile photo.';
  }
  if (cooldownMs > 0) {
    const seconds = Math.max(1, Math.ceil(cooldownMs / 1000));
    return `Please wait ${seconds} seconds before trying again. Your profile changes and photo are still here.`;
  }
  return (
    error?.userMessages?.join(' ') || 'Profile changes could not be saved.'
  );
}

export async function runProfileSaveSequence({
  photoAsset,
  uploadPhoto,
  onPhotoUploaded,
  saveFields,
}) {
  let uploadedPhoto = null;
  if (photoAsset) {
    uploadedPhoto = await uploadPhoto(photoAsset);
    await onPhotoUploaded(uploadedPhoto);
  }
  const card = await saveFields();
  return { uploadedPhoto, card };
}
