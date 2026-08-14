/* @flow */
'use strict';

import {
  classifyFirstPartyMemberRoute,
  nativeCollectionRoute,
  nativeTopicRoute,
} from '../nativeMemberRouting';

describe('native authenticated member routing', () => {
  test.each([
    ['https://adjusternetwork.org/t/example/42', 42],
    ['https://adjusternetwork.org/t/42', 42],
    ['https://adjusternetwork.org/t/example/42/3', 42],
    ['https://adjusternetwork.org/t/example/42?u=qa_test', 42],
  ])(
    'routes authenticated topic %s through the native API view',
    (url, topicId) => {
      expect(nativeTopicRoute(url, true)).toMatchObject({ topicId });
    },
  );

  test.each([
    'https://adjusternetwork.org/c/claims/3',
    'https://adjusternetwork.org/u/qa_test',
    'https://example.com/t/example/42',
    'http://adjusternetwork.org/t/example/42',
    'not a url',
  ])('does not misroute non-topic or unsafe URL %s', url => {
    expect(nativeTopicRoute(url, true)).toBeNull();
  });

  test('fails closed while logged out', () => {
    expect(
      nativeTopicRoute('https://adjusternetwork.org/t/example/42', false),
    ).toBeNull();
  });

  test.each([
    ['https://adjusternetwork.org/tag/today-in-claims', 'tag', '/search.json?q=tags%3Atoday-in-claims%20order%3Alatest'],
    ['https://adjusternetwork.org/tag/claims-weather', 'tag', '/search.json?q=tags%3Aclaims-weather%20order%3Alatest'],
    ['https://adjusternetwork.org/tag/field-knowledge', 'tag', '/search.json?q=tags%3Afield-knowledge%20order%3Alatest'],
    ['https://adjusternetwork.org/c/property/7', 'category', '/c/property/7.json'],
  ])('routes first-party collection %s natively', (url, kind, endpoint) => {
    expect(nativeCollectionRoute(url, true)).toMatchObject({ kind, endpoint });
  });

  test.each([
    'https://example.com/tag/today-in-claims',
    'http://adjusternetwork.org/tag/today-in-claims',
    'https://adjusternetwork.org/u/qa_test',
    'https://adjusternetwork.org/tag/../../admin',
  ])('rejects unsafe or unsupported collection route %s', url => {
    expect(nativeCollectionRoute(url, true)).toBeNull();
  });

  test.each([
    ['https://adjusternetwork.org/new-topic', 'Ask'],
    ['https://adjusternetwork.org/u/qa_test', 'MemberProfile'],
    ['https://adjusternetwork.org/u/qa_test/activity', 'MemberProfile'],
    ['https://adjusternetwork.org/u/qa_test/preferences/account', 'Settings'],
  ])('classifies ordinary member route %s as native %s', (url, screen) => {
    expect(
      classifyFirstPartyMemberRoute(url, { authenticated: true }),
    ).toMatchObject({ disposition: 'native', screen });
  });

  test('keeps admin fail-closed for members and explicit for staff', () => {
    expect(
      classifyFirstPartyMemberRoute('https://adjusternetwork.org/admin', {
        authenticated: true,
        isStaff: false,
      }),
    ).toEqual({ disposition: 'rejected' });
    expect(
      classifyFirstPartyMemberRoute('https://adjusternetwork.org/admin', {
        authenticated: true,
        isStaff: true,
      }),
    ).toMatchObject({ disposition: 'privileged_external' });
  });

  test.each([
    'https://adjusternetwork.org/login',
    'https://adjusternetwork.org/auth/provider',
    'https://adjusternetwork.org/session/sso',
    'https://adjusternetwork.org/unknown',
  ])('rejects unapproved first-party WebView route %s', url => {
    expect(
      classifyFirstPartyMemberRoute(url, { authenticated: true }),
    ).toEqual({ disposition: 'rejected' });
  });
});
