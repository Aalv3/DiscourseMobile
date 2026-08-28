/* @flow */
'use strict';

export const activeMemberSite = siteManager =>
  siteManager.listSites().find(site => site.authToken) || null;

const COMMUNITY_RETRY_DELAYS_MS = [650, 1800];
const communityLoads = new WeakMap();
const communitySnapshots = new WeakMap();

export function cachedCommunity(site) {
  if (!site || (typeof site !== 'object' && typeof site !== 'function')) {
    return null;
  }
  return communitySnapshots.get(site) || null;
}

export const communityRequestCanRetry = error =>
  error?.status == null || error.status >= 500;

export const classifyCommunityLoadError = error =>
  error?.status === 429 || error?.message === 'api_rate_limited'
    ? 'rate_limited'
    : 'unavailable';

export async function loadCommunityResource(
  request,
  delay = ms => new Promise(resolve => setTimeout(resolve, ms)),
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const retryDelay = COMMUNITY_RETRY_DELAYS_MS[attempt];
      if (retryDelay == null || !communityRequestCanRetry(error)) throw error;
      await delay(retryDelay);
    }
  }
}

async function loadCommunityUncached(site) {
  if (!site) return { topics: [], categories: [] };
  const [latest, siteInfo] = await Promise.all([
    loadCommunityResource(() => site.jsonApi('/latest.json')),
    loadCommunityResource(() => site.jsonApi('/site.json')),
  ]);
  const snapshot = {
    topics: latest?.topic_list?.topics || [],
    categories: siteInfo?.categories || [],
  };
  communitySnapshots.set(site, snapshot);
  return snapshot;
}

// Floor, Discussions, and Ask remain mounted as sibling tabs. A shared
// invalidation therefore asks each surface to refresh at the same time. Share
// that one in-flight request without retaining a stale result afterward.
export async function loadCommunity(site) {
  if (!site || (typeof site !== 'object' && typeof site !== 'function')) {
    return loadCommunityUncached(site);
  }
  const existing = communityLoads.get(site);
  if (existing) return existing;
  const pending = loadCommunityUncached(site).finally(() => {
    if (communityLoads.get(site) === pending) communityLoads.delete(site);
  });
  communityLoads.set(site, pending);
  return pending;
}

export const topicPath = topic => `/t/${topic.slug || 'topic'}/${topic.id}`;

// Discourse only assigns the full permission value (1) in site.json when the
// current Guardian may create topics in that category. Visibility alone is
// not sufficient: read-only categories remain visible to members.
export const askableCategories = categories =>
  (Array.isArray(categories) ? categories : []).filter(
    category => category?.permission === 1,
  );
