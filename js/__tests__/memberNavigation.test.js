/* @flow */
'use strict';

import {
  canOpenMemberAdjusterCard,
  openMemberAdjusterCard,
} from '../product/memberNavigation';

describe('canonical member Adjuster Card navigation', () => {
  test('opens a valid member identity natively', () => {
    const navigation = { navigate: jest.fn() };
    expect(openMemberAdjusterCard(navigation, 'qa_test')).toBe(true);
    expect(navigation.navigate).toHaveBeenCalledWith('MemberProfile', {
      username: 'qa_test',
    });
  });

  test.each([null, '', '../admin', 'member/name', 'x'.repeat(101)])(
    'rejects unavailable or unsafe identity %p',
    username => {
      const navigation = { navigate: jest.fn() };
      expect(canOpenMemberAdjusterCard(username)).toBe(false);
      expect(openMemberAdjusterCard(navigation, username)).toBe(false);
      expect(navigation.navigate).not.toHaveBeenCalled();
    },
  );
});
