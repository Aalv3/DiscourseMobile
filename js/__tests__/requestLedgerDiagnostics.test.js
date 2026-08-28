/* @flow */
'use strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  recordRequestLedger,
  requestLedgerKey,
  requestLedgerLimit,
} from '../requestLedgerDiagnostics';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

describe('privacy-safe request ledger', () => {
  test('persists only bounded request classes without origins or identities', async () => {
    recordRequestLedger({
      event: 'started',
      key: 'https://staging.adjusternetwork.org:private-client:GET:/native/v1/profile?username=private',
      active: 2,
      priority: 'visible',
    });
    await Promise.resolve();
    await Promise.resolve();
    const serialized = AsyncStorage.setItem.mock.calls.at(-1)?.[1] || '';
    expect(serialized).toContain('GET:/native/v1/profile');
    expect(serialized).not.toContain('private-client');
    expect(serialized).not.toContain('username');
    expect(serialized).not.toContain('staging.adjusternetwork.org');
    expect(requestLedgerKey).toBe('@AdjusterNetwork.requestLedger.v1');
    expect(requestLedgerLimit).toBe(256);
  });
});
