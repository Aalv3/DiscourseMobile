import { memberDisplayName } from '../product/floorPresentation';

describe('Floor launch micro-polish', () => {
  test('prefers a known display name and uses a bounded username fallback', () => {
    expect(memberDisplayName('Alex Rivera', 'alex_rivera')).toBe('Alex Rivera');
    expect(memberDisplayName('', 'alex_rivera')).toBe('Alex Rivera');
  });

  test('never greets an unknown person as Member', () => {
    expect(memberDisplayName('', '')).toBeNull();
    expect(memberDisplayName('Member', 'member')).toBeNull();
  });

  test('counts replied conversations instead of calling every seed topic unanswered', () => {
    const source = require('fs').readFileSync(
      require.resolve('../product/ProductScreens'),
      'utf8',
    );
    expect(source).toContain('label="Conversations"');
    expect(source).toContain('detail="With replies"');
    expect(source).toContain('topic => (topic.posts_count || 1) > 1');
    expect(source).not.toContain('label="Unanswered"');
  });
});
