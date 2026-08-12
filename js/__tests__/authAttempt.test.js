import {
  consumePendingAuthAttempt,
  shouldReportAuthFailure,
  shouldOpenCallbackOneTimePassword,
} from '../authAttempt';

describe('authentication attempt state', () => {
  test('is consumed exactly once', () => {
    const site = { url: 'https://adjusternetwork.org' };
    const manager = { _nonceSite: site, _nonce: 'synthetic-nonce' };

    expect(consumePendingAuthAttempt(manager)).toEqual({
      site,
      nonce: 'synthetic-nonce',
    });
    expect(consumePendingAuthAttempt(manager)).toEqual({
      site: null,
      nonce: null,
    });
  });

  test('opens the callback OTP only for the isolated iOS WebView session', () => {
    expect(shouldOpenCallbackOneTimePassword('android')).toBe(false);
    expect(shouldOpenCallbackOneTimePassword('ios')).toBe(true);
  });

  test('does not report browser invalidation after callback success', () => {
    expect(shouldReportAuthFailure(1)).toBe(false);
    expect(shouldReportAuthFailure(0)).toBe(true);
  });
});
