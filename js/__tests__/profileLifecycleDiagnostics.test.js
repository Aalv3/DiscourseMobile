jest.mock('../profileDiagnostics', () => ({
  profileErrorCategory: error =>
    error?.code === 'profile_load_timeout' ? 'timeout' : 'safe_failure',
  recordProfileDiagnostic: jest.fn(),
}));

import { recordProfileDiagnostic } from '../profileDiagnostics';
import { loadMemberProfileData } from '../product/memberProfileData';

describe('profile request lifecycle diagnostics', () => {
  beforeEach(() => recordProfileDiagnostic.mockClear());

  test('records each request and the successful execution-timeout policy', async () => {
    const site = {
      url: 'https://private.invalid',
      username: 'private-member',
      jsonApi: jest.fn(path =>
        Promise.resolve(
          path.includes('user_actions')
            ? { user_actions: [] }
            : path.includes('/u/')
            ? { user: { username: 'private-member' } }
            : { schema: 'an.adjuster-card.v2' },
        ),
      ),
    };
    await loadMemberProfileData(site, 'private-member', {
      mountId: 'profile-test-1',
      sequence: 1,
    });
    const entries = recordProfileDiagnostic.mock.calls.map(([entry]) => entry);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'request',
          stage: 'member_core',
          outcome: 'started',
        }),
        expect.objectContaining({
          event: 'request',
          stage: 'member_activity',
          outcome: 'settled',
        }),
        expect.objectContaining({
          event: 'request',
          stage: 'adjuster_card',
          category: 'success',
        }),
        expect.objectContaining({
          event: 'timer',
          stage: 'network_transport',
          outcome: 'delegated',
        }),
        expect.objectContaining({
          event: 'promise_all',
          outcome: 'settled',
        }),
      ]),
    );
  });

  test('records a failed request and rejected aggregate', async () => {
    const failureError = new Error('offline');
    const site = {
      url: 'https://private.invalid',
      username: 'private-member',
      jsonApi: jest.fn(path =>
        path.includes('/native/v1/profile')
          ? Promise.reject(failureError)
          : Promise.resolve(null),
      ),
    };
    const pending = loadMemberProfileData(site, 'private-member', {
      mountId: 'profile-test-2',
      sequence: 2,
    });
    const failure = expect(pending).rejects.toThrow('offline');
    await failure;
    const entries = recordProfileDiagnostic.mock.calls.map(([entry]) => entry);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'request',
          stage: 'adjuster_card',
          outcome: 'settled',
          category: 'safe_failure',
        }),
        expect.objectContaining({
          event: 'promise_all',
          outcome: 'rejected',
          category: 'safe_failure',
        }),
      ]),
    );
  });
});
