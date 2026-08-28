import fs from 'fs';
import path from 'path';

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('profile runtime stability', () => {
  test('profile loading is bounded and preserves last-known state', () => {
    const screen = read('product/NativeProfileScreen.js');
    const data = read('product/memberProfileData.js');
    const site = read('site.js');
    const transport = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'fetch.js'),
      'utf8',
    );

    expect(data).toContain("stage: 'network_transport'");
    expect(data).toContain("outcome: 'delegated'");
    expect(data).not.toContain('const bounded =');
    expect(site.indexOf('apiRateLimitCoordinator.wait(this.url)')).toBeLessThan(
      site.indexOf('const activeFetch = fetch(req)'),
    );
    expect(transport).toContain('var _timeout = 10000');
    expect(transport).toContain('xhr.timeout = _timeout');
    expect(data).toContain('cache.set(key, result)');
    expect(screen).toContain('cachedMemberProfileData(site, username)');
    expect(screen).toContain('const loading = false');
    expect(screen).toContain("'Waiting briefly for member details…'");
    expect(screen).toContain("'Refreshing…'");
    expect(screen).not.toContain('<ContentSkeleton');
    expect(screen).toContain('...current,\n        loading: false');
    expect(screen).toContain('Your last profile remains available.');
    expect(screen).toContain('sequence === loadSequence.current');
    expect(screen).toContain('authoritativeAvatar.current');
    expect(screen).toContain('responseAvatar !== latestAvatar');
    expect(screen).not.toContain('availableContributionActions(');
    expect(screen).toContain('const actions = activity?.user_actions || [];');
  });

  test('picker cancel and upload completion always clear the busy state', () => {
    const screen = read('product/NativeProfileScreen.js');

    expect(screen).toContain('if (result.canceled)');
    expect(screen).toContain('photoPreviewUri: asset.uri');
    expect(screen).toContain('submitting: false');
    expect(screen).toContain('uploadedPhoto.avatarTemplate');
    expect(screen).toContain('site.invalidateApiCache?.([');
    expect(screen).toContain('photoAsset: null');
    expect(screen).toContain('cooldownUntil: cooldownMs > 0');
    expect(screen).toContain('cooldownSeconds > 0 ?');
    expect(screen).toContain('<ProfileSaveCooldownControl');
    expect(screen).toContain(
      'if (!canStartProfileSave(editor.cooldownUntil)) {',
    );
    expect(screen).toContain('...current,\n        submitting: false');
    expect(screen).not.toMatch(
      /import \{\s*canStartProfileSave,[\s\S]*?\} from 'react-native'/,
    );
    expect(screen).toMatch(
      /import \{\s*canStartProfileSave,[\s\S]*?\} from '\.\/profileSaveState'/,
    );
    [
      'save_handler_started',
      'save_guard_passed',
      'save_guard_blocked',
      'photo_upload_started',
      'photo_upload_result',
      'profile_patch_started',
      'profile_patch_result',
      'save_completed',
      'save_failed',
    ].forEach(event => expect(screen).toContain(`event: '${event}'`));
  });

  test('profile code does not cross protected application boundaries', () => {
    const screen = read('product/NativeProfileScreen.js');
    const data = read('product/memberProfileData.js');
    const combined = `${screen}\n${data}`;

    expect(combined).not.toMatch(
      /SiteManager\.load|authRestoring|PushFoundation|pushStatus|unreadNotifications|setApplicationIconBadgeNumber|communityData|Floor/,
    );
    expect(combined).not.toMatch(
      /AppDelegate|ShareExtension|RCTLinkingManager/,
    );
  });

  test('records mount, effect, sequence, state, navigation and render lifecycle', () => {
    const screen = read('product/NativeProfileScreen.js');
    expect(screen).toContain("event: 'mount'");
    expect(screen).toContain("event: 'effect'");
    expect(screen).toContain("event: 'sequence'");
    expect(screen).toContain("event: 'state'");
    expect(screen).toContain("event: 'navigation'");
    expect(screen).toContain("event: 'render'");
    expect(screen).toContain('branch: diagnosticRenderBranch');
    expect(screen).toContain("outcome: accepted ? 'accepted' : 'discarded'");
  });
});
