import fs from 'fs';
import path from 'path';

describe('auth and push identity separation', () => {
  test('APNs registration has no path to SiteManager auth client-ID state', () => {
    const discourseSource = fs.readFileSync(
      path.join(__dirname, '..', 'Discourse.js'),
      'utf8',
    );
    const managerSource = fs.readFileSync(
      path.join(__dirname, '..', 'site_manager.js'),
      'utf8',
    );

    expect(discourseSource).not.toContain('registerClientId');
    expect(managerSource).not.toContain('registerClientId');
    expect(managerSource).toContain("AsyncStorage.setItem('@ClientId'");
    expect(managerSource).toContain('site.clientId = cid');
    expect(managerSource).toContain('client_id: clientId');
  });

  test('A3 transport owns the APNs token without writing auth client-ID storage', () => {
    const transportSource = fs.readFileSync(
      path.join(__dirname, '..', 'platforms', 'push-transport.ios.js'),
      'utf8',
    );

    expect(transportSource).toContain("addEventListener('register'");
    expect(transportSource).toContain('currentToken = token');
    expect(transportSource).not.toContain('@ClientId');
    expect(transportSource).not.toContain('.clientId =');
  });

  test('replacement authorization is server-attested before credential commit', () => {
    const managerSource = fs.readFileSync(
      path.join(__dirname, '..', 'site_manager.js'),
      'utf8',
    );
    const verifyIndex = managerSource.indexOf(
      "'/native/v1/authorization-profile'",
    );
    const persistIndex = managerSource.indexOf(
      'storeSiteToken(nonceSite.url, decrypted.key)',
    );
    expect(verifyIndex).toBeGreaterThan(0);
    expect(persistIndex).toBeGreaterThan(verifyIndex);
    expect(managerSource).toContain('restorePreviousAuthorization');
    expect(managerSource).toContain(
      'validateAuthorizationProfile(authorizationProfile, nonceSite.clientId)',
    );
  });
});
