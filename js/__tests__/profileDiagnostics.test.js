jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createProfileMountId,
  profileDiagnosticKey,
  profileDiagnosticLimit,
  profileErrorCategory,
  recordProfileDiagnostic,
} from '../profileDiagnostics';

describe('profile diagnostics', () => {
  beforeEach(() => {
    AsyncStorage.getItem.mockClear();
    AsyncStorage.setItem.mockClear();
  });

  test('records only bounded privacy-safe lifecycle fields', async () => {
    const entry = recordProfileDiagnostic({
      event: 'request',
      mountId: createProfileMountId(),
      sequence: 3,
      stage: 'adjuster_card',
      outcome: 'settled',
      category: '429',
      url: 'https://private.example/u/private-member',
      token: 'private-token',
      content: 'private-profile-content',
    });
    expect(entry).toMatchObject({
      event: 'request',
      sequence: 3,
      stage: 'adjuster_card',
      outcome: 'settled',
      category: '429',
    });
    expect(JSON.stringify(entry)).not.toMatch(
      /private\.example|private-member|private-token|private-profile-content|url|token|content/,
    );
    await new Promise(resolve => setImmediate(resolve));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      profileDiagnosticKey,
      expect.any(String),
    );
    expect(profileDiagnosticLimit).toBe(160);
  });

  test('reduces failures to HTTP class or bounded category', () => {
    expect(profileErrorCategory({ status: 429 })).toBe('429');
    expect(profileErrorCategory({ status: 403 })).toBe('4xx');
    expect(profileErrorCategory({ status: 503 })).toBe('5xx');
    expect(profileErrorCategory({ code: 'profile_load_timeout' })).toBe(
      'timeout',
    );
    expect(profileErrorCategory(new Error('private detail'))).toBe(
      'network_or_unknown',
    );
  });

  test('device harness exposes the profile stream', () => {
    const source = require('fs').readFileSync(
      require('path').join(
        __dirname,
        '..',
        '..',
        'scripts',
        'native-device-harness.mjs',
      ),
      'utf8',
    );
    expect(source).toContain('profile-diagnostics');
    expect(source).toContain(profileDiagnosticKey);
  });
});
