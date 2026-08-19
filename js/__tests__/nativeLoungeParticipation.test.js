/* @flow */
'use strict';

import {
  canSendToLounge,
  canDeleteOwnLoungeMessage,
  findLoungeChannel,
  loungeMessagesPath,
  loungeSendDisabledReason,
  mergeChatMessages,
  normalizeChatMessages,
} from '../product/LoungeChat';
import fs from 'fs';
import path from 'path';

const screenSource = fs.readFileSync(
  path.join(__dirname, '../product/NativeLoungeScreen.js'),
  'utf8',
);
const emojiSource = fs.readFileSync(
  path.join(__dirname, '../product/EmojiTextInput.js'),
  'utf8',
);

describe('native Lounge Chat participation', () => {
  test('discovers the existing Lounge chat channel', () => {
    expect(
      findLoungeChannel([
        { public_channels: [{ id: 1, title: 'General' }] },
        { channels: [{ id: 7, title: 'Lounge', slug: 'lounge' }] },
      ]),
    ).toMatchObject({ id: 7, slug: 'lounge' });
  });

  test('uses bounded Chat history pagination', () => {
    expect(loungeMessagesPath(7)).toBe(
      '/chat/api/channels/7/messages.json?page_size=50&direction=past',
    );
    expect(loungeMessagesPath(7, 100)).toContain('target_message_id=100');
  });

  test('sorts, merges, and hides deleted Chat messages', () => {
    const initial = normalizeChatMessages({
      messages: [
        { id: 3, message: 'new' },
        { id: 1, message: 'old' },
        { id: 2, deleted_at: 'now' },
      ],
    });
    expect(initial.map(message => message.id)).toEqual([1, 3]);
    expect(
      mergeChatMessages(initial, [
        { id: 3, message: 'updated' },
        { id: 4, message: 'latest' },
      ]),
    ).toEqual([
      { id: 1, message: 'old' },
      { id: 3, message: 'updated' },
      { id: 4, message: 'latest' },
    ]);
  });

  test('respects channel, membership, and silencing permissions', () => {
    expect(
      canSendToLounge({
        status: 'open',
        current_user_membership: { id: 1 },
        meta: { user_silenced: false },
      }),
    ).toBe(true);
    expect(
      canSendToLounge({
        status: 'open',
        meta: { can_join_chat_channel: true, user_silenced: false },
      }),
    ).toBe(true);
    expect(
      canSendToLounge({ status: 'open', meta: { user_silenced: true } }),
    ).toBe(false);
    expect(loungeSendDisabledReason({ status: 'closed', meta: {} })).toBe(
      'The Lounge is currently read-only.',
    );
  });

  test('only offers message deletion to its authenticated author', () => {
    const own = { id: 10, user: { username: 'qa_test' } };
    expect(canDeleteOwnLoungeMessage(own, 'qa_test')).toBe(true);
    expect(canDeleteOwnLoungeMessage(own, 'another_member')).toBe(false);
    expect(
      canDeleteOwnLoungeMessage({ ...own, can_delete: false }, 'qa_test'),
    ).toBe(false);
    expect(
      canDeleteOwnLoungeMessage({ ...own, deleted_at: 'now' }, 'qa_test'),
    ).toBe(false);
    expect(screenSource).toContain(
      '/chat/api/channels/${chat.channel.id}/messages/${item.id}.json',
    );
    expect(screenSource).toContain("'DELETE'");
  });

  test('keeps an accessible emoji option in the anchored composer', () => {
    expect(screenSource).toContain('<EmojiTextInput');
    expect(emojiSource).toContain("'Add emoji'");
    expect(emojiSource).toContain('accessibilityLabel="Emoji choices"');
    expect(emojiSource).toContain("'👍'");
    expect(emojiSource).toContain("'🎉'");
    expect(emojiSource).toContain("'🌪️'");
    expect(emojiSource).toContain('horizontal');
  });

  test('uses one in-flow keyboard-aware chat viewport', () => {
    expect(screenSource).toContain(
      "behavior={Platform.OS === 'ios' ? 'padding'",
    );
    expect(screenSource).toContain('style={styles.chatArea}');
    expect(screenSource).toContain('keyboardWillShow');
    expect(screenSource).not.toContain("position: 'absolute'");
    expect(screenSource).not.toContain(
      "behavior={Platform.OS === 'ios' ? 'position'",
    );
  });

  test('keeps V1 Lounge text-only with no attachment or upload path', () => {
    expect(screenSource).not.toContain('AttachmentComposer');
    expect(screenSource).not.toContain('useAttachmentQueue');
    expect(screenSource).not.toContain('upload_ids');
    expect(screenSource).not.toContain('Add photo or file');
  });
});
