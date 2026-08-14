import {
  consumePendingAuthAttempt,
  shouldReportAuthFailure,
  shouldReportAuthFailureAfterSettlement,
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

  test('waits for a concurrent Linking callback before reporting presentation failure', async () => {
    let connectedSites = 0;
    const manager = {
      connectedSitesCount: jest.fn(() => connectedSites),
      waitFor: jest.fn(async (_duration, check) => {
        connectedSites = 1;
        expect(check()).toBe(true);
      }),
    };

    await expect(shouldReportAuthFailureAfterSettlement(manager)).resolves.toBe(
      false,
    );
    expect(manager.waitFor).toHaveBeenCalledWith(2000, expect.any(Function));
  });

  test('reports a genuine failure after the callback settlement window', async () => {
    const manager = {
      connectedSitesCount: jest.fn(() => 0),
      waitFor: jest.fn(() => Promise.reject(new Error('timeout'))),
    };

    await expect(shouldReportAuthFailureAfterSettlement(manager)).resolves.toBe(
      true,
    );
  });
});
