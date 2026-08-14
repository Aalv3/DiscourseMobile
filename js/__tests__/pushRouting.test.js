import {
  notificationPayload,
  notificationTapPath,
  PendingPushRoute,
  routePush,
  safePushPath,
} from '../pushRouting';

describe('privacy-safe push routing', () => {
  test.each(['/t/member-topic/1', '/c/field-adjusting/4', '/u/qa_test'])(
    'allows member path %s',
    path => {
      expect(safePushPath({ an: { route: path } })).toBe(path);
    },
  );

  test.each([
    'https://adjusternetwork.org/t/1',
    '/admin',
    '/t/../../admin',
    '/session/otp/secret',
    null,
  ])('rejects unsafe path %p', path => {
    expect(safePushPath({ an: { route: path } })).toBeNull();
  });

  test('requires an authenticated session before opening content', () => {
    const openUrl = jest.fn();
    expect(
      routePush(
        { an: { route: '/t/safe/1' } },
        {
          origin: 'https://adjusternetwork.org',
          authenticated: false,
          openUrl,
        },
      ),
    ).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });

  test.each(['/t/member-topic/1', '/c/field-adjusting/4', '/u/qa_test'])(
    'extracts approved tapped APNs route %s',
    route => {
      const notification = {
        getData: () => ({
          aps: { alert: { title: 'Adjuster Network' } },
          an: { v: 1, notification_id: 'opaque', route },
          openedInForeground: 1,
        }),
      };
      expect(notificationTapPath(notification)).toBe(route);
    },
  );

  test('reads the nested APNs payload preserved by the iOS bridge', () => {
    const payload = { an: { route: '/t/safe/1' }, openedInForeground: 1 };
    expect(notificationPayload({ _data: payload })).toBe(payload);
  });

  test('recognizes the library cold-start interaction marker', () => {
    expect(
      notificationTapPath({
        _data: {
          an: { route: '/c/field-adjusting/4' },
          userInteraction: 1,
        },
      }),
    ).toBe('/c/field-adjusting/4');
  });

  test('does not route visible delivery until the member taps it', () => {
    expect(
      notificationTapPath({
        getData: () => ({ an: { route: '/t/safe/1' } }),
        getUserInteraction: () => false,
      }),
    ).toBeNull();
  });

  test.each(['/admin', '/t/../../admin', 'https://adjusternetwork.org/t/1'])(
    'rejects tapped disallowed route %s',
    route => {
      expect(
        notificationTapPath({
          _data: { an: { route }, openedInForeground: 1 },
        }),
      ).toBeNull();
    },
  );

  test('defers a cold-start tap until auth and navigation restoration finish', () => {
    const pending = new PendingPushRoute();
    const openUrl = jest.fn();
    expect(
      pending.accept({
        _data: {
          an: { route: '/t/about-the-site-feedback-category/1' },
          openedInForeground: 1,
        },
      }),
    ).toBe(true);
    expect(
      pending.flush({
        origin: 'https://adjusternetwork.org',
        authenticated: true,
        navigationReady: false,
        openUrl,
      }),
    ).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
    expect(
      pending.flush({
        origin: 'https://adjusternetwork.org',
        authenticated: true,
        navigationReady: true,
        openUrl,
      }),
    ).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(
      'https://adjusternetwork.org/t/about-the-site-feedback-category/1',
    );
  });

  test('retains a warm-start tap while authentication is unavailable', () => {
    const pending = new PendingPushRoute();
    const openUrl = jest.fn();
    pending.accept({
      _data: { an: { route: '/u/qa_test' }, openedInForeground: 1 },
    });
    expect(
      pending.flush({
        origin: 'https://adjusternetwork.org',
        authenticated: false,
        navigationReady: true,
        openUrl,
      }),
    ).toBe(false);
    expect(pending.path).toBe('/u/qa_test');
    expect(openUrl).not.toHaveBeenCalled();
  });
});
