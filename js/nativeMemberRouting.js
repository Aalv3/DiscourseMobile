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

export function nativeCollectionRoute(value, authenticated) {
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
    const tag = url.pathname.match(/^\/tag\/([a-z0-9-]+)\/?$/i);
    if (tag) {
      return {
        kind: 'tag',
        endpoint: `/search.json?q=${encodeURIComponent(
          `tags:${tag[1]} order:latest`,
        )}`,
        slug: tag[1],
        url: url.toString(),
      };
    }
    const category = url.pathname.match(
      /^\/c\/([a-z0-9-]+)\/([1-9][0-9]*)\/?$/i,
    );
    if (category) {
      return {
        kind: 'category',
        endpoint: `/c/${category[1]}/${category[2]}.json`,
        slug: category[1],
        url: url.toString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}
