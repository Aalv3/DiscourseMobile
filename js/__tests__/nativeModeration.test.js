/* @flow */
'use strict';

import {
  blockMember,
  deleteOwnAccount,
  moderationFlagType,
  reportChatMessage,
  reportPost,
} from '../product/NativeModeration';

const site = overrides => ({
  authToken: 'synthetic-token',
  username: 'reviewer',
  jsonApi: jest.fn(() => Promise.resolve({ success: true })),
  ...overrides,
});

describe('native Discourse moderation and deletion contracts', () => {
  test('loads a server-defined inappropriate flag and reports a post', async () => {
    const memberSite = site({
      jsonApi: jest
        .fn()
        .mockResolvedValueOnce({
          post_action_types: [
            { id: 2, name_key: 'like', is_flag: false },
            { id: 41, name_key: 'inappropriate', is_flag: true },
          ],
        })
        .mockResolvedValueOnce({ success: true }),
    });
    await expect(moderationFlagType(memberSite)).resolves.toBe(41);
    await reportPost(memberSite, 17);
    expect(memberSite.jsonApi).toHaveBeenLastCalledWith(
      '/post_actions.json',
      'POST',
      { id: 17, post_action_type_id: 41, flag_topic: false },
    );
  });

  test('fails closed when the server exposes no supported flag type', async () => {
    const memberSite = site({
      jsonApi: jest.fn(() => Promise.resolve({ post_action_types: [] })),
    });
    await expect(moderationFlagType(memberSite)).rejects.toThrow(
      'reporting_unavailable',
    );
  });

  test('reports a Lounge message through Discourse Chat review', async () => {
    const memberSite = site({
      jsonApi: jest
        .fn()
        .mockResolvedValueOnce({
          post_action_types: [
            { id: 8, name_key: 'notify_moderators', is_flag: true },
          ],
        })
        .mockResolvedValueOnce({ success: true }),
    });
    await reportChatMessage(memberSite, 9, 22);
    expect(memberSite.jsonApi).toHaveBeenLastCalledWith(
      '/chat/api/channels/9/messages/22/flags.json',
      'POST',
      { flag_type_id: 8 },
    );
  });

  test('blocks a different member through the supported ignore endpoint', async () => {
    const memberSite = site();
    await blockMember(memberSite, 'abusive_member');
    const [path, method, payload] = memberSite.jsonApi.mock.calls[0];
    expect(path).toBe('/u/abusive_member/notification_level.json');
    expect(method).toBe('PUT');
    expect(payload.notification_level).toBe('ignore');
    expect(Number.isNaN(new Date(payload.expiring_at).getTime())).toBe(false);
    await expect(blockMember(memberSite, 'reviewer')).rejects.toThrow(
      'blocking_unavailable',
    );
  });

  test('deletes only the authenticated account through Discourse Guardian', async () => {
    const memberSite = site();
    await deleteOwnAccount(memberSite);
    expect(memberSite.jsonApi).toHaveBeenCalledWith(
      '/u/reviewer.json',
      'DELETE',
      { context: 'native_member_request' },
    );
    await expect(deleteOwnAccount(site({ authToken: null }))).rejects.toThrow(
      'authentication_required',
    );
  });
});
