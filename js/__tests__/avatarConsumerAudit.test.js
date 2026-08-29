import fs from 'fs';
import path from 'path';

describe('native avatar consumer audit', () => {
  const source = file =>
    fs.readFileSync(path.join(__dirname, '..', 'product', file), 'utf8');

  test.each([
    ['ProductScreens.js', /<Avatar[\s\S]*avatarTemplate=/],
    ['NativeProfileScreen.js', /<MemberAvatar/],
    ['NativeLoungeScreen.js', /<MemberAvatar/],
    ['NativeTopicScreen.js', /<MemberAvatar/],
    ['NativeCollectionScreen.js', /<MemberAvatar[\s\S]*avatarTemplate=/],
    ['NativeMemberUtilityScreens.js', /<MemberAvatar/],
  ])(
    '%s delegates visible member photos to the shared component',
    (file, pattern) => {
      expect(source(file)).toMatch(pattern);
    },
  );

  test.each([
    'NativeLoungeScreen.js',
    'NativeTopicScreen.js',
    'NativeMemberUtilityScreens.js',
  ])('%s no longer maintains a parallel avatar URL builder', file => {
    expect(source(file)).not.toMatch(
      /const\s+(memberA|a)avatar(?:Uri|Url)\s*=/i,
    );
  });
});
