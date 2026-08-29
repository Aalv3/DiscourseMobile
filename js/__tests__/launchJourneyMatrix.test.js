/* @flow */
'use strict';

import matrix from '../../testing/launch-certification/journeys.json';

describe('executable launch journey map', () => {
  test('covers every launch/auth/onboarding lifecycle without a dead end', () => {
    expect(matrix.schema).toBe('an.launch-certification.v1');
    expect(matrix.journeys.map(journey => journey.id)).toEqual(
      expect.arrayContaining([
        'new_applicant',
        'approved_incomplete',
        'approved_complete',
        'returning_cold_launch',
        'revoked_credential',
        'interrupted_onboarding',
        'deferred_onboarding',
        'transport_failures',
      ]),
    );
    const transitions = matrix.journeys.flatMap(journey => journey.transitions);
    expect(transitions.length).toBeGreaterThanOrEqual(15);
    transitions.forEach(transition => {
      expect(transition).toEqual(
        expect.objectContaining({
          state: expect.any(String),
          screen: expect.any(String),
          action: expect.any(String),
          api: expect.any(String),
          prerequisite: expect.any(String),
          success: expect.any(String),
          failure: expect.any(String),
          recovery: expect.any(String),
        }),
      );
      expect(transition.recovery).not.toMatch(/none|dead end/i);
    });
  });

  test('never grants guarded member access from a deferred onboarding state', () => {
    const deferred = matrix.journeys.find(
      journey => journey.id === 'deferred_onboarding',
    );
    expect(
      deferred.transitions.every(item => item.success !== 'member_floor'),
    ).toBe(true);
  });
});
