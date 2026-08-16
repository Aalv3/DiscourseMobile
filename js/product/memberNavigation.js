/* @flow */
'use strict';

const VALID_USERNAME = /^[a-z0-9_.-]+$/i;

export function canOpenMemberAdjusterCard(username) {
  return (
    typeof username === 'string' &&
    username.length > 0 &&
    username.length <= 100 &&
    VALID_USERNAME.test(username)
  );
}

export function openMemberAdjusterCard(navigation, username) {
  if (!navigation || !canOpenMemberAdjusterCard(username)) return false;
  navigation.navigate('MemberProfile', { username });
  return true;
}
