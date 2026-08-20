/* @flow */
'use strict';

export const activeMemberSite = siteManager =>
  siteManager.listSites().find(site => site.authToken) || null;

const COMMUNITY_RETRY_DELAYS_MS = [650, 1800];

export const communityRequestCanRetry = error =>
  error?.status == null || error.status === 429 || error.status >= 500;

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

export async function loadCommunity(site) {
  if (!site) return { topics: [], categories: [] };
  const [latest, siteInfo] = await Promise.all([
    loadCommunityResource(() => site.jsonApi('/latest.json')),
    loadCommunityResource(() => site.jsonApi('/site.json')),
  ]);
  return {
    topics: latest?.topic_list?.topics || [],
    categories: siteInfo?.categories || [],
  };
}

export const topicPath = topic => `/t/${topic.slug || 'topic'}/${topic.id}`;

// Discourse only assigns the full permission value (1) in site.json when the
// current Guardian may create topics in that category. Visibility alone is
// not sufficient: read-only categories remain visible to members.
export const askableCategories = categories =>
  (Array.isArray(categories) ? categories : []).filter(
    category => category?.permission === 1,
  );
