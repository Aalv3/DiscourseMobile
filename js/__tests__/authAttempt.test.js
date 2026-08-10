import { consumePendingAuthAttempt } from '../authAttempt';

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
});
