/* @flow */
'use strict';

import {
  findRecentMatchingTopic,
  submitAskQuestion,
} from '../product/AskSubmission';

const attachment = {
  name: 'synthetic.pdf',
  type: 'application/pdf',
  status: 'succeeded',
  upload: { id: 4, short_url: 'upload://synthetic.pdf' },
};

describe('Ask submission sequencing', () => {
  test('an offline attachment failure never sends the topic request', async () => {
    const site = { jsonApi: jest.fn() };
    await expect(
      submitAskQuestion({
        site,
        uploadAll: jest.fn().mockRejectedValue(new Error('offline')),
        title: 'Synthetic offline test',
        raw: 'Safe fixture',
        categoryId: 2,
      }),
    ).rejects.toMatchObject({ askSubmissionStage: 'attachment_upload' });
    expect(site.jsonApi).not.toHaveBeenCalled();
  });

  test('offline upload then retry creates one topic with one attachment', async () => {
    const site = {
      jsonApi: jest
        .fn()
        .mockResolvedValue({ topic_id: 12, topic_slug: 'safe' }),
    };
    const uploadAll = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([attachment]);
    await expect(
      submitAskQuestion({
        site,
        uploadAll,
        title: 'Unique synthetic retry title',
        raw: 'Safe fixture',
        categoryId: 2,
      }),
    ).rejects.toMatchObject({ askSubmissionStage: 'attachment_upload' });
    await expect(
      submitAskQuestion({
        site,
        uploadAll,
        title: 'Unique synthetic retry title',
        raw: 'Safe fixture',
        categoryId: 2,
      }),
    ).resolves.toMatchObject({ created: { topic_id: 12 } });
    expect(site.jsonApi).toHaveBeenCalledTimes(1);
    expect(site.jsonApi).toHaveBeenCalledWith('/posts.json', 'POST', {
      title: 'Unique synthetic retry title',
      raw: 'Safe fixture\n\n[synthetic.pdf](upload://synthetic.pdf)',
      category: 2,
    });
  });

  test('recovers an accepted topic when the create response is lost', async () => {
    const createdAt = new Date().toISOString();
    const site = {
      username: 'media_member',
      jsonApi: jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockResolvedValueOnce({
          topic_list: {
            topics: [
              {
                id: 91,
                slug: 'recovered',
                title: 'Recovered topic',
                created_at: createdAt,
                last_poster_username: 'media_member',
              },
            ],
          },
        }),
    };
    await expect(
      submitAskQuestion({
        site,
        uploadAll: jest.fn().mockResolvedValue([attachment]),
        title: 'Recovered topic',
        raw: '',
        categoryId: 2,
      }),
    ).resolves.toMatchObject({
      recovered: true,
      created: { topic_id: 91, topic_slug: 'recovered' },
    });
    expect(site.jsonApi).toHaveBeenCalledTimes(2);
  });

  test('an unreconciled create response fails closed instead of resubmitting', async () => {
    const site = {
      jsonApi: jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockRejectedValueOnce(new TypeError('Still offline')),
    };
    await expect(
      submitAskQuestion({
        site,
        uploadAll: jest.fn().mockResolvedValue([attachment]),
        title: 'Uncertain topic',
        raw: '',
        categoryId: 2,
      }),
    ).rejects.toMatchObject({
      message: 'topic_submission_unconfirmed',
      askSubmissionStage: 'topic_submission_unconfirmed',
    });
    expect(site.jsonApi).toHaveBeenCalledTimes(2);
  });

  test('matching requires title, creator, and a recent creation time', () => {
    const startedAt = Date.now();
    expect(
      findRecentMatchingTopic(
        {
          topic_list: {
            topics: [
              {
                id: 5,
                title: ' Safe title ',
                last_poster_username: 'media_member',
                created_at: new Date(startedAt).toISOString(),
              },
            ],
          },
        },
        'safe TITLE',
        'media_member',
        startedAt,
      ),
    ).toMatchObject({ id: 5 });
  });
});
