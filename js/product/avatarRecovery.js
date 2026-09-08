/* @flow */
'use strict';

// A transient image failure must not permanently show the letter initial for
// the lifetime of a mounted Avatar. Stack screens remount on every navigation
// and the private member-photo route sends Cache-Control: private, no-store,
// so each mount issues a fresh authenticated request; a single 429 inside a
// limiter window used to latch the initial until the component unmounted.
//
// Recovery is bounded, not infinite: a small number of delayed attempts, then
// the initial stands. Attempts are per URI, so a changed photo starts fresh.
export const AVATAR_RECOVERY_MAX_ATTEMPTS = 2;
export const AVATAR_RECOVERY_DELAYS_MS = Object.freeze([1500, 6000]);

export function avatarRecoveryDelayMs(attempt) {
  if (!Number.isFinite(attempt) || attempt < 0) return null;
  if (attempt >= AVATAR_RECOVERY_MAX_ATTEMPTS) return null;
  return AVATAR_RECOVERY_DELAYS_MS[attempt] ?? null;
}

export function shouldAttemptAvatarRecovery(attempt) {
  return avatarRecoveryDelayMs(attempt) !== null;
}

// The initial is shown only once recovery is exhausted for this exact URI.
export function avatarShowsImage({ resolvedUri, failedUri, attempt }) {
  if (!resolvedUri) return false;
  if (failedUri !== resolvedUri) return true;
  return shouldAttemptAvatarRecovery(attempt);
}
