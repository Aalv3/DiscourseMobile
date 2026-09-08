/* @flow */
'use strict';

import { recordProfileDiagnostic } from '../profileDiagnostics';
import { stagingDiagnosticsEnabled } from '../stagingDiagnostics';
import { isMemberPhotoUrl, memberImageSource } from './memberImageSource';

// Temporary instrumentation for the production profile-photo inconsistency:
// the same member photo renders on You but falls back to a letter avatar on
// Member profile and Edit profile. This records how the shared Avatar resolved
// each render so the three surfaces can be compared directly.
//
// Gated on the staging OTA channel, so it cannot emit on a production binary
// even if this bundle were promoted. It records paths, templates and
// classifications only - credentials, headers and cookies are never passed in,
// and profileDiagnostics enforces a key allowlist besides.
export const AVATAR_SCREENS = Object.freeze({
  you: 'YOU',
  memberProfile: 'MEMBER_PROFILE',
  editProfile: 'EDIT_PROFILE',
});

export function avatarDiagnosticsEnabled() {
  return stagingDiagnosticsEnabled();
}

// Mirrors avatarAuthority.scopeKey so the recorded key is the real lookup key.
export function avatarAuthorityKey(site, username) {
  return `${String(site?.url || '')}:${String(username || '').toLowerCase()}`;
}

export function classifyAvatarSource(site, uri) {
  if (!uri) return 'none';
  const source = memberImageSource(site, uri);
  if (source?.headers) return 'authenticated_member_photo';
  if (isMemberPhotoUrl(uri)) return 'member_photo_unauthenticated';
  return /^https:\/\//i.test(String(uri))
    ? 'ordinary_unauthenticated'
    : 'bare_or_relative';
}

const pathOf = uri => {
  try {
    return new URL(String(uri)).pathname;
  } catch {
    return String(uri || 'none');
  }
};

export function recordAvatarResolution({
  screen,
  site,
  username,
  inputTemplate,
  authority,
  resolvedUri,
  size,
  failedUri,
  fallback,
}) {
  if (!screen || !avatarDiagnosticsEnabled()) return null;
  return recordProfileDiagnostic({
    event: 'avatar_resolve',
    screen,
    siteUsername: site?.username || 'none',
    requestedUsername: username || 'none',
    authorityKey: avatarAuthorityKey(site, username),
    authorityPresent: !!authority,
    authorityTemplate: authority?.template || 'none',
    inputTemplate: inputTemplate || 'none',
    resolvedPath: resolvedUri ? pathOf(resolvedUri) : 'none',
    size: size == null ? 'none' : String(size),
    authClass: classifyAvatarSource(site, resolvedUri),
    failedUriMatch: !!resolvedUri && failedUri === resolvedUri,
    fallback: fallback || 'image',
  });
}

export function recordAvatarImageEvent({
  screen,
  imageEvent,
  resolvedUri,
  error,
}) {
  if (!screen || !avatarDiagnosticsEnabled()) return null;
  // Only a bounded error class is recorded, never response bodies or headers.
  const errorClass = error
    ? String(error?.nativeEvent?.error || error?.message || 'unknown').slice(
        0,
        120,
      )
    : undefined;
  return recordProfileDiagnostic({
    event: 'avatar_image',
    screen,
    imageEvent,
    resolvedPath: resolvedUri ? pathOf(resolvedUri) : 'none',
    errorClass,
  });
}
