import JSEncrypt from '../../lib/jsencrypt';

describe('legacy RSA release compatibility', () => {
  test('loads without creating a global KJUR namespace', () => {
    expect(JSEncrypt).toEqual(expect.any(Function));
    expect(global.KJUR).toBeUndefined();
  });

  test('decrypts standard Base64 ciphertext under strict module execution', () => {
    const crypt = new JSEncrypt({ default_key_size: 512 });
    const ciphertext = crypt.encrypt('callback-probe');

    expect(ciphertext).toEqual(expect.any(String));
    expect(crypt.decrypt(ciphertext)).toBe('callback-probe');
  });
});
