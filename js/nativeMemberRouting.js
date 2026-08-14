/* @flow */
'use strict';

import { adjusterNetwork } from './adjusterNetworkConfig';

export function nativeTopicRoute(value, authenticated) {
  if (!authenticated || typeof value !== 'string' || value.length > 4096) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.origin !== adjusterNetwork.canonicalOrigin
    ) {
      return null;
    }
    const match = url.pathname.match(
      /^\/t\/(?:[^/]+\/)?([1-9][0-9]*)(?:\/[1-9][0-9]*)?\/?$/,
    );
    if (!match) return null;
    return { topicId: Number(match[1]), url: url.toString() };
  } catch {
    return null;
  }
}
