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
        endpoint: `/tag/${encodeURIComponent(tag[1])}.json`,
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

export function classifyFirstPartyMemberRoute(
  value,
  { authenticated = false, isStaff = false } = {},
) {
  if (!authenticated || typeof value !== 'string' || value.length > 4096) {
    return { disposition: 'rejected' };
  }
  const topic = nativeTopicRoute(value, true);
  if (topic) return { disposition: 'native', screen: 'Topic', params: topic };
  const collection = nativeCollectionRoute(value, true);
  if (collection) {
    return { disposition: 'native', screen: 'Collection', params: collection };
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.origin !== adjusterNetwork.canonicalOrigin
    ) {
      return { disposition: 'rejected' };
    }
    if (/^\/search\/?$/i.test(url.pathname)) {
      return { disposition: 'native', screen: 'Search', params: {} };
    }
    const bookmarks = url.pathname.match(
      /^\/u\/([a-z0-9_.-]+)\/activity\/bookmarks\/?$/i,
    );
    if (bookmarks) {
      return {
        disposition: 'native',
        screen: 'Bookmarks',
        params: { username: bookmarks[1] },
      };
    }
    const profile = url.pathname.match(
      /^\/u\/([a-z0-9_.-]+)(?:\/activity(?:\/[^/]+)?)?\/?$/i,
    );
    if (profile) {
      return {
        disposition: 'native',
        screen: 'MemberProfile',
        params: { username: profile[1] },
      };
    }
    if (/^\/u\/[a-z0-9_.-]+\/preferences(?:\/[^/]+)?\/?$/i.test(url.pathname)) {
      return { disposition: 'native', screen: 'Settings', params: {} };
    }
    if (/^\/new-topic\/?$/i.test(url.pathname)) {
      return { disposition: 'native', screen: 'Ask', params: {} };
    }
    if (/^\/admin(?:\/.*)?$/i.test(url.pathname)) {
      return isStaff
        ? { disposition: 'privileged_external', url: url.toString() }
        : { disposition: 'rejected' };
    }
    return { disposition: 'rejected' };
  } catch {
    return { disposition: 'rejected' };
  }
}
