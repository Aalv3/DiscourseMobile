/* @flow */
'use strict';

import { nativeTopicRoute } from '../nativeMemberRouting';

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
});
