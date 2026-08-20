/* @flow */
'use strict';

const IMAGE_EXTENSIONS = new Set([
  'avif',
  'gif',
  'heic',
  'heif',
  'jpeg',
  'jpg',
  'png',
  'webp',
]);

const extensionOf = name => {
  const match = String(name || '')
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
};

export const attachmentIsImage = attachment =>
  String(attachment?.type || '')
    .toLowerCase()
    .startsWith('image/') ||
  IMAGE_EXTENSIONS.has(extensionOf(attachment?.name));

export const attachmentName = asset =>
  asset?.fileName || asset?.name || `attachment-${Date.now()}`;

export const normalizePickerAsset = asset => ({
  localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  uri: asset.uri,
  name: attachmentName(asset),
  type: asset.mimeType || asset.type || 'application/octet-stream',
  size: Number(asset.fileSize || asset.size || 0),
  width: asset.width || null,
  height: asset.height || null,
  status: 'queued',
  error: null,
  upload: null,
});

export const uploadErrorMessage = error => {
  if (error?.status === 413) return 'This file exceeds the site upload limit.';
  if (error?.status === 415) return 'This file type is not supported.';
  if (error?.status === 403) {
    return 'Your account is not permitted to upload this file.';
  }
  if (error?.status === 422 && error?.userMessages?.length) {
    return error.userMessages.join(' ');
  }
  if (error?.status === 429) {
    return 'Uploads are temporarily rate-limited. Please wait and retry.';
  }
  return 'Upload failed. Check your connection and retry.';
};

export function uploadAttachment(
  site,
  attachment,
  uploadType,
  onRequest = () => {},
) {
  if (!site?.authToken || !attachment?.uri) {
    throw new Error('invalid_upload_asset');
  }
  const form = new FormData();
  // Discourse's uploader reserves `type` for the file MIME type. Its
  // composer context is sent separately as `upload_type`.
  form.append('upload_type', uploadType);
  form.append('file', {
    uri: attachment.uri,
    name: attachment.name,
    type: attachment.type,
  });
  const request = site.multipartApi('/uploads.json', form);
  onRequest(request);
  return request.then(payload => {
    if (!payload?.id || !(payload.short_url || payload.url)) {
      throw new Error('invalid_upload_response');
    }
    return payload;
  });
}

export const uploadMarkup = attachment => {
  const upload = attachment?.upload;
  const url = upload?.short_url || upload?.url;
  if (!url) return '';
  const name = upload.original_filename || attachment.name || 'attachment';
  return attachmentIsImage(attachment)
    ? `![${name}](${url})`
    : `[${name}](${url})`;
};

export const appendUploadMarkup = (raw, attachments) => {
  const markup = attachments.map(uploadMarkup).filter(Boolean).join('\n\n');
  if (!markup) return String(raw || '').trim();
  const body = String(raw || '').trim();
  return body ? `${body}\n\n${markup}` : markup;
};

export const successfulUploadIds = attachments =>
  attachments
    .filter(item => item.status === 'succeeded' && item.upload?.id)
    .map(item => item.upload.id);

export const mediaPrivacyReminder =
  'Keep claim data out. Do not upload insured information, claim numbers, loss addresses, private carrier documents, or other claim-identifying material.';
