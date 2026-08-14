/* @flow */
'use strict';

export async function topicAvailable(site, topicId) {
  if (!site || !topicId) return false;
  try {
    await site.jsonApi(`/t/${topicId}.json`);
    return true;
  } catch (error) {
    return error?.status !== 404 && error?.status !== 403;
  }
}

export async function availableContributionActions(site, actions) {
  const candidates = (Array.isArray(actions) ? actions : []).slice(0, 20);
  const availability = await Promise.all(
    candidates.map(action => topicAvailable(site, action?.topic_id)),
  );
  return candidates.filter((_, index) => availability[index]);
}

export async function availableNotificationRows(rows) {
  const availability = await Promise.all(
    rows.map(row => {
      const notification = row?.notification;
      const topicId = notification?.topic_id || notification?.data?.topic_id;
      return topicId ? topicAvailable(row.site, topicId) : true;
    }),
  );
  const stale = rows.filter((_, index) => !availability[index]);
  await Promise.all(
    stale.map(row =>
      row.site.readNotification(row.notification).catch(() => {}),
    ),
  );
  return rows.filter((_, index) => availability[index]);
}
