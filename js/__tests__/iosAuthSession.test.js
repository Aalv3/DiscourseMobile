jest.mock('react-native-safari-web-auth', () => ({ requestAuth: jest.fn() }));

import SafariWebAuth from 'react-native-safari-web-auth';
import { requestIOSAuth } from '../iosAuthSession';

describe('iOS authentication presentation failures', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each(['auth_presentation_unavailable', 'auth_start_failed'])(
    'propagates the native %s failure',
    async code => {
      const failure = new Error(code);
      SafariWebAuth.requestAuth.mockRejectedValueOnce(failure);

      await expect(
        requestIOSAuth(
          'https://adjusternetwork.org/user-api-key/new',
          'adjusternetwork',
        ),
      ).rejects.toBe(failure);
    },
  );

  test('rejects missing or unapproved callbacks', async () => {
    SafariWebAuth.requestAuth.mockResolvedValueOnce(undefined);
    await expect(
      requestIOSAuth('https://adjusternetwork.org/auth', 'adjusternetwork'),
    ).rejects.toThrow('auth_callback_invalid');

    SafariWebAuth.requestAuth.mockResolvedValueOnce(
      'evil://auth_redirect?payload=x',
    );
    await expect(
      requestIOSAuth('https://adjusternetwork.org/auth', 'adjusternetwork'),
    ).rejects.toThrow('auth_callback_invalid');
  });

  test('returns an approved callback unchanged for state and payload validation', async () => {
    const callback = 'adjusternetwork://auth_redirect?payload=opaque';
    SafariWebAuth.requestAuth.mockResolvedValueOnce(callback);

    await expect(
      requestIOSAuth('https://adjusternetwork.org/auth', 'adjusternetwork'),
    ).resolves.toBe(callback);
  });
});
