/* @flow */
'use strict';

import {
  availableContributionActions,
  availableNotificationRows,
} from '../memberContentAvailability';

describe('native profile contribution availability', () => {
  test('removes deleted and forbidden topic actions', async () => {
    const site = {
      jsonApi: jest.fn(path => {
        if (path.includes('/52.json')) return Promise.reject({ status: 404 });
        if (path.includes('/53.json')) return Promise.reject({ status: 403 });
        return Promise.resolve({ can_creator_delete: false });
      }),
    };
    await expect(
      availableContributionActions(site, [
        { id: 1, topic_id: 51 },
        { id: 2, topic_id: 52 },
        { id: 3, topic_id: 53 },
      ]),
    ).resolves.toEqual([{ id: 1, topic_id: 51 }]);
  });

  test('preserves valid history through transient failures', async () => {
    const site = { jsonApi: jest.fn(() => Promise.reject({ status: 503 })) };
    await expect(
      availableContributionActions(site, [{ id: 1, topic_id: 51 }]),
    ).resolves.toEqual([{ id: 1, topic_id: 51 }]);
  });

  test('drops malformed non-topic activity and bounds validation', async () => {
    const site = { jsonApi: jest.fn(() => Promise.resolve({})) };
    const actions = [{ id: 'missing' }].concat(
      Array.from({ length: 25 }, (_, index) => ({
        id: index,
        topic_id: index + 1,
      })),
    );
    const result = await availableContributionActions(site, actions);
    expect(site.jsonApi).toHaveBeenCalledTimes(19);
    expect(result).toHaveLength(19);
  });

  test('removes and marks stale topic notifications while preserving non-topic activity', async () => {
    const site = {
      jsonApi: jest.fn(path =>
        path.includes('/52.json')
          ? Promise.reject({ status: 404 })
          : Promise.resolve({}),
      ),
      readNotification: jest.fn(() => Promise.resolve()),
    };
    const stale = { notification: { id: 1, topic_id: 52 }, site };
    const current = { notification: { id: 2, topic_id: 51 }, site };
    const nonTopic = { notification: { id: 3 }, site };
    await expect(
      availableNotificationRows([stale, current, nonTopic]),
    ).resolves.toEqual([current, nonTopic]);
    expect(site.readNotification).toHaveBeenCalledWith(stale.notification);
  });
});
