import React from 'react';
import renderer from 'react-test-renderer';
import ProfileSaveCooldownControl from '../product/ProfileSaveCooldownControl';

describe('profile save cooldown control', () => {
  test('renders a visibly disabled non-actionable countdown', () => {
    let tree;
    renderer.act(() => {
      tree = renderer.create(
        <ProfileSaveCooldownControl
          colors={{
            surfaceAlt: '#EEEEEE',
            border: '#AAAAAA',
            muted: '#555555',
          }}
          seconds={32}
        />,
      );
    });
    const root = tree.root;
    const control = root.find(node =>
      node.props.accessibilityLabel?.startsWith('Save profile unavailable'),
    );
    expect(control.props.accessibilityState).toEqual({ disabled: true });
    expect(control.props.onPress).toBeUndefined();
    expect(JSON.stringify(tree.toJSON())).toContain('Please wait ');
    expect(JSON.stringify(tree.toJSON())).toContain('32');
  });
});
