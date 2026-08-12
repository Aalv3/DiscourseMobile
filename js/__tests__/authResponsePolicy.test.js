import { classifyAuthResponse } from '../authResponsePolicy';

describe('auth response policy', () => {
  test('revokes a session only when authentication is invalid', () => {
    expect(classifyAuthResponse(401)).toBe('revoked');
  });

  test('preserves narrowly scoped sessions when an endpoint is forbidden', () => {
    expect(classifyAuthResponse(403)).toBe('forbidden');
  });

  test('leaves unrelated response handling to the caller', () => {
    expect(classifyAuthResponse(404)).toBe('other');
    expect(classifyAuthResponse(500)).toBe('other');
  });
});
