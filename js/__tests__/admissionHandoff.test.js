'use strict';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import {
  ADMISSION_HANDOFF_STORAGE,
  ADMISSION_RETURN_URI,
  beginAdmissionHandoff,
  parseAdmissionReturn,
  reconcileAdmissionReturn,
  validateIssuedHandoff,
} from '../admissionHandoff';

jest.mock('expo-updates', () => ({ channel: 'production' }));

const ID = '21eb7dcf-a095-4b58-bda8-a67f40cf3069';
const EXPIRES = '2030-08-24T12:05:00Z';
const CONFIRMATION = 'c'.repeat(43);
const BROWSER_TOKEN = 'b'.repeat(43);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(Linking, 'openURL').mockResolvedValue();
});

afterEach(() => jest.restoreAllMocks());

test('accepts only the canonical HTTPS bearer landing URL', () => {
  const valid = {
    handoff_id: ID,
    browser_url: `https://adjusternetwork.org/renaissance/admission-handoff#token=${BROWSER_TOKEN}`,
    expires_at: EXPIRES,
    confirmation_token: CONFIRMATION,
  };
  expect(
    validateIssuedHandoff(valid, Date.parse('2030-08-24T12:00:00Z')),
  ).toMatchObject({ handoffId: ID });
  for (const browser_url of [
    'http://adjusternetwork.org/renaissance/admission-handoff#token=x',
    'https://evil.example/renaissance/admission-handoff#token=x',
    'https://adjusternetwork.org/elsewhere#token=x',
    'https://adjusternetwork.org/renaissance/admission-handoff?next=https://evil.example#token=x',
    'javascript:alert(1)',
  ]) {
    expect(() =>
      validateIssuedHandoff(
        { ...valid, browser_url },
        Date.parse('2030-08-24T12:00:00Z'),
      ),
    ).toThrow('admission_handoff_invalid');
  }
});

test('issuance persists no bearer and opens only the validated browser URL', async () => {
  const site = {
    url: 'https://adjusternetwork.org',
    authToken: 'not-logged-by-test',
    clientId: 'client-a',
    jsonApi: jest.fn().mockResolvedValue({
      handoff_id: ID,
      browser_url: `https://adjusternetwork.org/renaissance/admission-handoff#token=${BROWSER_TOKEN}`,
      expires_at: EXPIRES,
      confirmation_token: CONFIRMATION,
    }),
  };
  await beginAdmissionHandoff(site);
  expect(site.jsonApi).toHaveBeenCalledWith(
    '/native/v1/admission-handoffs',
    'POST',
    { return_uri: ADMISSION_RETURN_URI },
  );
  const stored = await AsyncStorage.getItem(ADMISSION_HANDOFF_STORAGE);
  expect(stored).toContain(ID);
  expect(stored).not.toContain(BROWSER_TOKEN);
  expect(Linking.openURL).toHaveBeenCalledWith(
    expect.stringMatching(/^https:\/\/adjusternetwork\.org\//),
  );
});

test('browser launch failure interrupts and removes local correlation state', async () => {
  Linking.openURL.mockRejectedValueOnce(new Error('browser_unavailable'));
  const site = {
    url: 'https://adjusternetwork.org',
    authToken: 'not-logged-by-test',
    clientId: 'client-a',
    jsonApi: jest
      .fn()
      .mockResolvedValueOnce({
        handoff_id: ID,
        browser_url: `https://adjusternetwork.org/renaissance/admission-handoff#token=${BROWSER_TOKEN}`,
        expires_at: EXPIRES,
        confirmation_token: CONFIRMATION,
      })
      .mockResolvedValueOnce({ handoff_id: ID, result: 'interrupted' }),
  };
  await expect(beginAdmissionHandoff(site)).rejects.toThrow(
    'browser_unavailable',
  );
  await expect(
    AsyncStorage.getItem(ADMISSION_HANDOFF_STORAGE),
  ).resolves.toBeNull();
  expect(site.jsonApi).toHaveBeenLastCalledWith(
    `/native/v1/admission-handoffs/${ID}/interruption`,
    'POST',
  );
});

test('confirmation callback proves native possession before browser finalization', async () => {
  const site = {
    url: 'https://adjusternetwork.org',
    authToken: 'not-logged-by-test',
    clientId: 'client-a',
    jsonApi: jest
      .fn()
      .mockResolvedValueOnce({
        handoff_id: ID,
        browser_url: `https://adjusternetwork.org/renaissance/admission-handoff#token=${BROWSER_TOKEN}`,
        confirmation_token: CONFIRMATION,
        expires_at: EXPIRES,
      })
      .mockResolvedValueOnce({
        handoff_id: ID,
        finalize_url: `https://adjusternetwork.org/renaissance/admission-handoff/finalize?id=${ID}`,
        result: 'interrupted',
      }),
  };
  await beginAdmissionHandoff(site);
  Linking.openURL.mockClear();
  await expect(
    reconcileAdmissionReturn(
      site,
      { admission_handoff: 'confirmation_required', handoff_id: ID },
      Date.parse('2030-08-24T12:00:00Z'),
    ),
  ).resolves.toEqual({ result: 'interrupted', admissionComplete: false });
  expect(site.jsonApi).toHaveBeenLastCalledWith(
    `/native/v1/admission-handoffs/${ID}/confirmation`,
    'POST',
    { confirmation_token: CONFIRMATION },
  );
  expect(Linking.openURL).toHaveBeenCalledWith(
    `https://adjusternetwork.org/renaissance/admission-handoff/finalize?id=${ID}`,
  );
});

test('callback never establishes completion without authoritative status', async () => {
  await AsyncStorage.setItem(
    ADMISSION_HANDOFF_STORAGE,
    JSON.stringify({
      handoffId: ID,
      expiresAt: EXPIRES,
      siteOrigin: 'https://adjusternetwork.org',
    }),
  );
  const site = {
    url: 'https://adjusternetwork.org',
    jsonApi: jest.fn().mockResolvedValue({
      handoff_id: ID,
      result: 'success',
      admission_complete: false,
    }),
  };
  await expect(
    reconcileAdmissionReturn(
      site,
      { admission_handoff: 'success', handoff_id: ID },
      Date.parse('2030-08-24T12:00:00Z'),
    ),
  ).resolves.toEqual({ result: 'success', admissionComplete: false });
});

test('server completion remains authoritative after local issuance expiry', async () => {
  await AsyncStorage.setItem(
    ADMISSION_HANDOFF_STORAGE,
    JSON.stringify({
      handoffId: ID,
      expiresAt: '2020-01-01T00:00:00Z',
      siteOrigin: 'https://adjusternetwork.org',
    }),
  );
  const site = {
    url: 'https://adjusternetwork.org',
    jsonApi: jest.fn().mockResolvedValue({
      handoff_id: ID,
      result: 'success',
      admission_complete: true,
    }),
  };
  await expect(
    reconcileAdmissionReturn(site, {
      admission_handoff: 'success',
      handoff_id: ID,
    }),
  ).resolves.toEqual({ result: 'success', admissionComplete: true });
  expect(site.jsonApi).toHaveBeenCalledTimes(1);
});

test('wrong correlation and unrecognized result fail closed', async () => {
  expect(
    parseAdmissionReturn({ admission_handoff: 'success', handoff_id: 'wrong' }),
  ).toBeNull();
  expect(
    parseAdmissionReturn({ admission_handoff: 'accepted', handoff_id: ID }),
  ).toBeNull();
});

test('replayed callback cannot use cleared pending state', async () => {
  await AsyncStorage.setItem(
    ADMISSION_HANDOFF_STORAGE,
    JSON.stringify({
      handoffId: ID,
      expiresAt: EXPIRES,
      siteOrigin: 'https://adjusternetwork.org',
    }),
  );
  const site = {
    url: 'https://adjusternetwork.org',
    jsonApi: jest.fn().mockResolvedValue({
      handoff_id: ID,
      result: 'success',
      admission_complete: true,
    }),
  };
  const params = { admission_handoff: 'success', handoff_id: ID };
  await expect(
    reconcileAdmissionReturn(site, params, Date.parse('2030-08-24T12:00:00Z')),
  ).resolves.toEqual({ result: 'success', admissionComplete: true });
  await expect(
    reconcileAdmissionReturn(site, params, Date.parse('2030-08-24T12:00:00Z')),
  ).resolves.toEqual({ result: 'invalid', admissionComplete: false });
  expect(site.jsonApi).toHaveBeenCalledTimes(1);
});
