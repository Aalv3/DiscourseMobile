import { floorAttentionState } from '../product/floorAttention';

describe('Floor attention classification', () => {
  test('does not present an official zero-reply announcement as needing a reply', () => {
    expect(
      floorAttentionState({
        posts_count: 1,
        an_network_activity_class: 'owner_editorial',
      }),
    ).toEqual({ label: 'OFFICIAL', icon: 'bullhorn', needsReply: false });
  });

  test('preserves attention for a genuinely unanswered member discussion', () => {
    expect(
      floorAttentionState({
        posts_count: 1,
        an_network_activity_class: 'member_activity',
      }),
    ).toEqual({ label: 'NEEDS A REPLY', icon: 'question', needsReply: true });
  });

  test('fails closed for unknown and replied topic classes', () => {
    expect(floorAttentionState({ posts_count: 1 }).needsReply).toBe(false);
    expect(
      floorAttentionState({
        posts_count: 2,
        an_network_activity_class: 'member_activity',
      }),
    ).toEqual({ label: 'ACTIVE', icon: 'comments', needsReply: false });
  });
});
