import { NativeModules } from 'react-native';
import fs from 'fs';
import path from 'path';
import { recordPushRegistrationResult } from '../pushRegistrationDiagnostics';

describe('physical push registration diagnostics', () => {
  test('passes only the bounded result contract to native unified logging', () => {
    const record = jest.fn();
    NativeModules.DiscourseKeyboardShortcuts = {
      recordPushRegistrationResult: record,
    };
    const safe = recordPushRegistrationResult({
      stage: 'backend_response',
      category: 'backend_rejection',
      httpStatusClass: '4xx',
      outcome: 'failed',
      token: 'must-not-pass',
      installationId: 'must-not-pass',
      nonce: 'must-not-pass',
    });
    expect(safe).toEqual({
      stage: 'backend_response',
      category: 'backend_rejection',
      httpStatusClass: '4xx',
      outcome: 'failed',
    });
    expect(record).toHaveBeenCalledWith(safe);
    expect(JSON.stringify(record.mock.calls)).not.toMatch(
      /must-not-pass|token|installationId|nonce/,
    );
  });

  test('invalid diagnostic values fail closed to bounded defaults', () => {
    NativeModules.DiscourseKeyboardShortcuts = {
      recordPushRegistrationResult: jest.fn(),
    };
    expect(
      recordPushRegistrationResult({
        stage: 'secret-stage',
        category: 'private-error',
        httpStatusClass: '403 exact',
        outcome: 'details',
      }),
    ).toEqual({
      stage: 'unknown',
      category: 'unknown_registration_failure',
      httpStatusClass: 'none',
      outcome: 'failed',
    });
  });

  test('release native logger validates allowlists and logs no identifiers', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../ios/DiscourseKeyboardShortcuts.m'),
      'utf8',
    );
    expect(source).toContain('recordPushRegistrationResult');
    expect(source).toContain('ANPushRegistration stage=');
    expect(source).toContain('[stages containsObject:stage]');
    expect(source).not.toMatch(
      /ANPushRegistration[^\n]*(token|installation|nonce|auth)/i,
    );
  });
});
