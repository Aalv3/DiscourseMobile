import fs from 'fs';
import path from 'path';

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('profile runtime stability', () => {
  test('profile loading is bounded and preserves last-known state', () => {
    const screen = read('product/NativeProfileScreen.js');
    const data = read('product/memberProfileData.js');

    expect(data).toContain('profile_load_timeout');
    expect(data).toContain('cache.set(cacheKey(site, username), result)');
    expect(screen).toContain('cachedMemberProfileData(site, username)');
    expect(screen).toContain(
      'loading: current.user == null && current.card == null',
    );
    expect(screen).toContain('...current,\n        loading: false');
    expect(screen).toContain('Your last profile remains available.');
    expect(screen).toContain('sequence !== loadSequence.current');
    expect(screen.indexOf('setState({')).toBeLessThan(
      screen.indexOf('const actions = await availableContributionActions('),
    );
  });

  test('picker cancel and upload completion always clear the busy state', () => {
    const screen = read('product/NativeProfileScreen.js');

    expect(screen).toContain('if (result.canceled)');
    expect(screen).toContain('photoPreviewUri: asset.uri');
    expect(screen).toContain('submitting: false');
    expect(screen).toContain('uploadedPhoto.avatarTemplate');
    expect(screen).toContain(
      'photoAsset: uploadedPhoto ? current.photoAsset : null',
    );
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
});
