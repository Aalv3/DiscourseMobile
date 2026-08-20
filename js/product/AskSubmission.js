/* @flow */
'use strict';

import { appendUploadMarkup } from './MediaAttachments';

const normalizedTitle = value =>
  String(value || '')
    .trim()
    .toLowerCase();
const RECENT_TOPIC_WINDOW_MS = 10 * 60 * 1000;

export const isAmbiguousSubmissionFailure = error =>
  error?.status == null &&
  !['auth_forbidden', 'auth_revoked'].includes(error?.message);

export function findRecentMatchingTopic(payload, title, username, startedAt) {
  const topics = payload?.topic_list?.topics || [];
  return (
    topics.find(topic => {
      const createdAt = new Date(topic?.created_at).getTime();
      return (
        normalizedTitle(topic?.title) === normalizedTitle(title) &&
        topic?.last_poster_username === username &&
        Number.isFinite(createdAt) &&
        createdAt >= startedAt - RECENT_TOPIC_WINDOW_MS
      );
    }) || null
  );
}

export async function reconcileAskSubmission(site, title, startedAt) {
  const latest = await site.jsonApi('/latest.json');
  return findRecentMatchingTopic(latest, title, site.username, startedAt);
}

export async function submitAskQuestion({
  site,
  uploadAll,
  title,
  raw,
  categoryId,
}) {
  let attachments;
  try {
    attachments = await uploadAll();
  } catch (error) {
    error.askSubmissionStage = 'attachment_upload';
    throw error;
  }

  const startedAt = Date.now();
  try {
    const created = await site.jsonApi('/posts.json', 'POST', {
      title: title.trim(),
      raw: appendUploadMarkup(raw, attachments),
      category: categoryId,
    });
    return { created, startedAt, recovered: false };
  } catch (error) {
    if (!isAmbiguousSubmissionFailure(error)) throw error;
    try {
      const topic = await reconcileAskSubmission(site, title, startedAt);
      if (topic) {
        return {
          created: {
            topic_id: topic.id,
            topic_slug: topic.slug,
          },
          startedAt,
          recovered: true,
        };
      }
    } catch {
      // A failed reconciliation is intentionally represented as uncertain.
    }
    const uncertain = new Error('topic_submission_unconfirmed');
    uncertain.askSubmissionStage = 'topic_submission_unconfirmed';
    uncertain.startedAt = startedAt;
    throw uncertain;
  }
}
