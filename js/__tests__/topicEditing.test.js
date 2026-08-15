/* @flow */
'use strict';

import {
  canEditPost,
  loadEditablePost,
  savePostEdit,
} from '../product/topicEditing';

describe('Guardian-authorized topic editing', () => {
  test('exposes edit only from the server capability', () => {
    expect(canEditPost({ id: 1, can_edit: true })).toBe(true);
    expect(canEditPost({ id: 1, can_edit: false })).toBe(false);
    expect(canEditPost({ id: 1, username: 'current-user' })).toBe(false);
    expect(canEditPost({ can_edit: true })).toBe(false);
  });

  test('loads canonical raw content only for an editable post', async () => {
    const site = { jsonApi: jest.fn().mockResolvedValue({ raw: 'Saved body' }) };
    await expect(
      loadEditablePost(site, { id: 42, can_edit: true }),
    ).resolves.toBe('Saved body');
    expect(site.jsonApi).toHaveBeenCalledWith('/posts/42.json');
    await expect(
      loadEditablePost(site, { id: 43, can_edit: false }),
    ).rejects.toThrow('post_edit_not_authorized');
  });

  test('uses the authenticated Discourse edit contract', async () => {
    const site = { jsonApi: jest.fn().mockResolvedValue({ id: 42 }) };
    await expect(savePostEdit(site, 42, ' Updated reply ')).resolves.toEqual({
      id: 42,
    });
    expect(site.jsonApi).toHaveBeenCalledWith('/posts/42.json', 'PUT', {
      post: { raw: 'Updated reply' },
    });
  });
});
