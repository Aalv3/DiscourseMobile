import { routePush, safePushPath } from '../pushRouting';

describe('privacy-safe push routing', () => {
  test.each(['/t/member-topic/1', '/c/field-adjusting/4', '/u/qa_test'])(
    'allows member path %s',
    path => {
      expect(safePushPath({ path })).toBe(path);
    },
  );

  test.each([
    'https://adjusternetwork.org/t/1',
    '/admin',
    '/t/../../admin',
    '/session/otp/secret',
    null,
  ])('rejects unsafe path %p', path => {
    expect(safePushPath({ path })).toBeNull();
  });

  test('requires an authenticated session before opening content', () => {
    const openUrl = jest.fn();
    expect(
      routePush(
        { path: '/t/safe/1' },
        {
          origin: 'https://adjusternetwork.org',
          authenticated: false,
          openUrl,
        },
      ),
    ).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });
});
