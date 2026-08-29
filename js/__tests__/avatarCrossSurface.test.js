import React from 'react';
import { Image, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('@react-native-vector-icons/fontawesome5', () => 'FontAwesome5');

import {
  Avatar,
  topicPosterAvatarTemplate,
} from '../product/ProductComponents';
import {
  clearAvatarAuthorities,
  publishAvatarAuthority,
  removeAvatarAuthority,
} from '../product/avatarAuthority';

describe('canonical avatar rendering across native surfaces', () => {
  const site = { url: 'https://staging.example' };
  const renderers = [];

  beforeEach(() => clearAvatarAuthorities());
  afterEach(async () => {
    await act(async () => renderers.splice(0).forEach(item => item.unmount()));
    clearAvatarAuthorities();
  });

  const renderAvatar = async props => {
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <Avatar label="Member" site={site} size={48} {...props} />,
      );
    });
    renderers.push(renderer);
    return renderer;
  };

  test('mounted consumers follow upload, removal, and replacement authority', async () => {
    const renderer = await renderAvatar({
      avatarTemplate: '/old/{size}.png',
      username: 'member',
    });
    expect(renderer.root.findByType(Image).props.source.uri).toBe(
      'https://staging.example/old/48.png',
    );

    await act(async () => {
      publishAvatarAuthority(site, 'member', '/new/{size}.png');
    });
    expect(renderer.root.findByType(Image).props.source.uri).toBe(
      'https://staging.example/new/48.png',
    );

    await act(async () => removeAvatarAuthority(site, 'member'));
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    expect(renderer.root.findByType(View).props.accessibilityLabel).toBe(
      'Member profile placeholder',
    );

    await act(async () => {
      publishAvatarAuthority(site, 'member', '/replacement/{size}.png');
    });
    expect(renderer.root.findByType(Image).props.source.uri).toBe(
      'https://staging.example/replacement/48.png',
    );
  });

  test('an actual image failure selects fallback until the source changes', async () => {
    const renderer = await renderAvatar({
      avatarTemplate: '/broken/{size}.png',
      username: 'member',
    });
    await act(async () => renderer.root.findByType(Image).props.onError());
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);

    await act(async () => {
      publishAvatarAuthority(site, 'member', '/working/{size}.png');
    });
    expect(renderer.root.findByType(Image).props.source.uri).toBe(
      'https://staging.example/working/48.png',
    );
  });

  test('other-member canonical data renders without current-user authority', async () => {
    const renderer = await renderAvatar({
      avatarTemplate: '/other/{size}.png',
      username: 'other',
    });
    expect(renderer.root.findByType(Image).props.source.uri).toBe(
      'https://staging.example/other/48.png',
    );
  });

  test('topic rows select the canonical most-recent poster avatar', () => {
    expect(
      topicPosterAvatarTemplate({
        posters: [
          { avatar_template: '/original/{size}.png' },
          {
            avatar_template: '/latest/{size}.png',
            description: 'Most Recent Poster',
          },
        ],
      }),
    ).toBe('/latest/{size}.png');
  });
});
