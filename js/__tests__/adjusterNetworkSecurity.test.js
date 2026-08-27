import {
  classifyNavigation,
  isCanonicalUrl,
  isSafeAuthCallback,
} from '../adjusterNetworkSecurity';

describe('native navigation security boundary', () => {
  test.each([
    'https://adjusternetwork.org/',
    'https://adjusternetwork.org/t/private/123',
  ])('accepts canonical HTTPS route %s', url => {
    expect(classifyNavigation(url)).toBe('internal');
    expect(isCanonicalUrl(url)).toBe(true);
  });

  test.each([
    'http://adjusternetwork.org/',
    'javascript:alert(1)',
    'data:text/html,private',
    'file:///private/data',
    'discourse://evil?payload=x',
    'not a url',
  ])('rejects unsafe route %s', url => {
    expect(classifyNavigation(url)).toBe('reject');
  });

  test('does not confuse a prefix-confusable host with the canonical origin', () => {
    expect(
      classifyNavigation('https://adjusternetwork.org.evil.test/t/1'),
    ).toBe('external');
  });

  test('accepts only exact supported callback authorities', () => {
    expect(
      isSafeAuthCallback(
        'adjusternetwork://adjusternetwork.org/auth_redirect?payload=opaque',
      ),
    ).toBe(true);
    expect(isSafeAuthCallback('adjusternetwork://open?siteUrl=x')).toBe(true);
    expect(isSafeAuthCallback('adjusternetwork://share?sharedUrl=x')).toBe(
      true,
    );
    expect(isSafeAuthCallback('discourse://auth_redirect.evil?payload=x')).toBe(
      false,
    );
    expect(
      isSafeAuthCallback('adjusternetwork://auth_redirect?payload=opaque'),
    ).toBe(false);
  });

  test('routes ordinary HTTPS external links to the external boundary', () => {
    expect(classifyNavigation('https://www.weather.gov/')).toBe('external');
  });
});
