import JSEncrypt from '../../lib/jsencrypt';

describe('legacy RSA release compatibility', () => {
  test('loads without creating a global KJUR namespace', () => {
    expect(JSEncrypt).toEqual(expect.any(Function));
    expect(global.KJUR).toBeUndefined();
  });
});
