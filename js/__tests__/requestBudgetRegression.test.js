/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

const source = relative =>
  fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('authenticated request budget gates', () => {
  test('cold launch has four canonical resource requests and no metadata refresh fan-out', () => {
    const manager = source('site_manager.js');
    const discourse = source('Discourse.js');
    const community = source('product/ProductData.js');
    const loadBody = manager.slice(
      manager.indexOf('  load() {'),
      manager.indexOf('  totalUnread() {'),
    );
    expect(loadBody).not.toContain('ensureLatestApi');
    expect(loadBody).not.toContain('refreshSites');
    expect(loadBody).not.toContain('refreshNotificationState');
    expect(discourse).toContain('loadCanonicalOnboarding(site)');
    expect(discourse).toContain(
      'if (onboarding.status === ONBOARDING_STATUS.COMPLETED)',
    );
    expect(community).toContain("site.jsonApi('/latest.json')");
    expect(community).toContain("site.jsonApi('/site.json')");
  });

  test('foreground owns at most notification plus one shared Floor snapshot', () => {
    const discourse = source('Discourse.js');
    expect(discourse).toContain("_refreshAuthenticatedResources('foreground')");
    expect(discourse).toContain('now - this._lastForegroundRefreshAt < 30000');
    expect(discourse).not.toContain(
      'this._siteManager.refreshSites();\n        this._consumeShareIntent();',
    );
  });

  test('notifications and profiles cannot regress to per-topic probes', () => {
    const manager = source('site_manager.js');
    const site = source('site.js');
    const profile = source('product/memberProfileData.js');
    const screen = source('product/NativeProfileScreen.js');
    expect(site).toContain("'/native/v1/notifications'");
    expect(manager).not.toContain('availableNotificationRows(');
    expect(profile).not.toContain('/user_actions.json');
    expect(screen).not.toContain('availableContributionActions(');
    expect(profile.match(/site\.jsonApi\(/g)).toHaveLength(2);
  });

  test('unchanged push identity is persisted across JS processes', () => {
    const foundation = source('pushFoundation.js');
    expect(foundation).toContain('persistedIdentity !== identity');
    expect(foundation).toContain('setRegistrationIdentity?.(identity)');
  });
});
