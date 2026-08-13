import {
  parseAuthCallbackParameters,
  parseDecryptedAuthPayload,
} from '../authCallback';

describe('authentication callback parsing', () => {
  test('preserves padded Base64 and separates the OTP parameter', () => {
    const params = parseAuthCallbackParameters(
      'adjusternetwork://auth_redirect?payload=abc%2Bdef%2Fghi%3D%3D&oneTimePassword=otp%2Bvalue%3D',
    );

    expect(Object.keys(params)).toEqual(['payload', 'oneTimePassword']);
    expect(params.payload).toBe('abc+def/ghi==');
    expect(params.oneTimePassword).toBe('otp+value=');
  });

  test('preserves literal plus characters from native callback URLs', () => {
    const params = parseAuthCallbackParameters(
      'adjusternetwork://auth_redirect?payload=abc+def/ghi==',
    );

    expect(params.payload).toBe('abc+def/ghi==');
  });

  test('rejects unapproved callbacks', () => {
    expect(
      parseAuthCallbackParameters('evil://auth_redirect?payload=opaque'),
    ).toEqual({});
  });

  test('accepts only a decrypted JSON object', () => {
    expect(
      parseDecryptedAuthPayload(
        JSON.stringify({
          key: 'synthetic',
          nonce: 'expected',
          push: false,
          api: 4,
        }),
      ),
    ).toEqual({ key: 'synthetic', nonce: 'expected', push: false, api: 4 });
    expect(parseDecryptedAuthPayload(false)).toBeNull();
    expect(parseDecryptedAuthPayload('false')).toBeNull();
    expect(parseDecryptedAuthPayload('[]')).toBeNull();
    expect(parseDecryptedAuthPayload('not-json')).toBeNull();
  });
});
