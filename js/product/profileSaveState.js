/* @flow */
'use strict';

const DEFAULT_COOLDOWN_MS = 30000;
const MAX_COOLDOWN_MS = 5 * 60 * 1000;

export function profileCooldownSeconds(until, now = Date.now()) {
  return Math.max(0, Math.ceil((Number(until) - now) / 1000));
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
