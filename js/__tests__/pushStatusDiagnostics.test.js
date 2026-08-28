jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  pushStatusDiagnosticKey,
  recordPushStatusTransition,
} from '../pushStatusDiagnostics';

describe('push status diagnostics', () => {
  beforeEach(() => {
    AsyncStorage.getItem.mockClear();
    AsyncStorage.setItem.mockClear();
  });

  test('records only bounded privacy-safe state dimensions', async () => {
    const entry = recordPushStatusTransition({
      reason: 'background_registration_failure',
      previous: 'enabled',
      next: 'enabled',
      knownEnabled: true,
      foundation: {
        permission: 'granted',
        preference: 'enabled',
        backend: 'last_known_enabled',
        token: 'must-not-appear',
      },
      result: {
        category: 'backend_rate_limited',
        outcome: 'failed',
        httpStatusClass: '429',
        content: 'must-not-appear',
      },
    });

    expect(entry).toMatchObject({
      reason: 'background_registration_failure',
      previous: 'enabled',
      next: 'enabled',
      knownEnabled: true,
      permission: 'granted',
      preference: 'enabled',
      backend: 'last_known_enabled',
      category: 'backend_rate_limited',
      outcome: 'failed',
      http: '429',
    });
    expect(JSON.stringify(entry)).not.toMatch(/must-not-appear|token|content/);
    await new Promise(resolve => setImmediate(resolve));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      pushStatusDiagnosticKey,
      expect.any(String),
    );
  });

  test('device harness exposes the bounded diagnostic stream', () => {
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
    expect(source).toContain('push-status-diagnostics');
    expect(source).toContain(pushStatusDiagnosticKey);
  });
});
