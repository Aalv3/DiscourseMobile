/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';
import {
  AUTH_REDIRECT,
  REQUESTED_USER_API_KEY_SCOPES,
  USER_API_KEY_SCOPE_COPY,
  requestedUserApiKeyScopes,
} from '../authorizationConsent';

describe('native authorization consent', () => {
  test('uses a human-readable redirect host and never exposes the internal token', () => {
    expect(new URL(AUTH_REDIRECT).hostname).toBe('adjusternetwork.org');
    expect(new URL(AUTH_REDIRECT).pathname).toBe('/auth_redirect');
    expect(new URL(AUTH_REDIRECT).hostname).not.toBe('auth_redirect');
  });

  test('gives every requested scope intentional human-readable copy', () => {
    expect(Object.keys(USER_API_KEY_SCOPE_COPY).sort()).toEqual(
      [...REQUESTED_USER_API_KEY_SCOPES].sort(),
    );
    for (const scope of REQUESTED_USER_API_KEY_SCOPES) {
      expect(USER_API_KEY_SCOPE_COPY[scope]).toEqual(expect.any(String));
      expect(USER_API_KEY_SCOPE_COPY[scope]).not.toMatch(
        /translation missing/i,
      );
      expect(USER_API_KEY_SCOPE_COPY[scope]).not.toBe(scope);
    }
    expect(requestedUserApiKeyScopes()).toBe(
      REQUESTED_USER_API_KEY_SCOPES.join(','),
    );
  });

  test('binds scopes to the launch capabilities that consume them', () => {
    const root = path.join(__dirname, '..');
    const topic = fs.readFileSync(
      path.join(root, 'product/NativeTopicScreen.js'),
      'utf8',
    );
    const site = fs.readFileSync(path.join(root, 'site.js'), 'utf8');
    const manager = fs.readFileSync(path.join(root, 'site_manager.js'), 'utf8');
    const discourse = fs.readFileSync(path.join(root, 'Discourse.js'), 'utf8');
    const privacyContract = fs.readFileSync(
      path.join(root, '__tests__/sitePrivacy.test.js'),
      'utf8',
    );
    const memberSearch = fs.readFileSync(
      path.join(root, 'product/NativeMemberUtilityScreens.js'),
      'utf8',
    );

    expect(topic).toContain("jsonApi('/posts.json', 'POST'");
    expect(topic).toContain("jsonApi(`/posts/${post.id}.json`, 'DELETE')");
    expect(topic).toContain('savePostEdit(');
    expect(site).toContain("'/notifications/read', 'PUT'");
    expect(site).toContain("'/notifications.json?recent=true&limit=25'");
    expect(manager).toContain('urlParams.oneTimePassword');
    expect(discourse).toContain('params.oneTimePassword');
    expect(privacyContract).toContain("jsonApi('/session/current.json')");
    expect(memberSearch).toContain('/native/v1/member-search');
  });
});
