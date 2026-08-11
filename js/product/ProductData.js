/* @flow */
'use strict';

export const activeMemberSite = siteManager =>
  siteManager.listSites().find(site => site.authToken) || null;

export async function loadCommunity(site) {
  if (!site) return { topics: [], categories: [] };
  const [latest, siteInfo] = await Promise.all([
    site.jsonApi('/latest.json'),
    site.jsonApi('/site.json'),
  ]);
  return {
    topics: latest?.topic_list?.topics || [],
    categories: siteInfo?.categories || [],
  };
}

export const topicPath = topic => `/t/${topic.slug || 'topic'}/${topic.id}`;
