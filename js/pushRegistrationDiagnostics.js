/* @flow */
'use strict';

import { NativeModules } from 'react-native';
import { pushRegistrationResult } from './pushRegistrationResult';

// This bridge accepts only the bounded result contract. The native side
// validates the same allowlists before writing a privacy-safe unified-log event.
export function recordPushRegistrationResult(result) {
  const safe = pushRegistrationResult(result || {});
  try {
    NativeModules.DiscourseKeyboardShortcuts?.recordPushRegistrationResult?.(
      safe,
    );
  } catch {
    // Diagnostics are deliberately non-blocking.
  }
  return safe;
}
