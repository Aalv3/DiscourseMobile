/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('@react-native-vector-icons/fontawesome5', () => 'FontAwesome5');
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
import {
  appendUploadMarkup,
  attachmentIsImage,
  mediaPrivacyReminder,
  successfulUploadIds,
  uploadAttachment,
  uploadErrorMessage,
} from '../product/MediaAttachments';
import {
  chatMedia,
  cookedMedia,
  mediaRefreshErrorMessage,
  openSecureMediaFile,
  refreshSecureMedia,
  shouldRefreshSecureMedia,
} from '../product/DiscourseMedia';
import DiscourseMedia from '../product/DiscourseMedia';
import { mediaUploadsEnabledForSite } from '../adjusterNetworkConfig';

describe('native Discourse media attachments', () => {
  test('uploads files through the authenticated composer multipart contract', async () => {
    const OriginalFormData = global.FormData;
    global.FormData = class {
      values = [];
      append(key, value) {
        this.values.push([key, value]);
      }
    };
    try {
      const site = {
        authToken: 'present',
        multipartApi: jest.fn().mockResolvedValue({
          id: 42,
          short_url: 'upload://photo.png',
          original_filename: 'photo.png',
        }),
      };
      const result = await uploadAttachment(
        site,
        {
          uri: 'file:///photo.png',
          name: 'photo.png',
          type: 'image/png',
        },
        'composer',
      );
      expect(result.id).toBe(42);
      expect(site.multipartApi).toHaveBeenCalledWith(
        '/uploads.json',
        expect.any(global.FormData),
      );
      expect(site.multipartApi.mock.calls[0][1].values).toEqual([
        ['upload_type', 'composer'],
        [
          'file',
          {
            uri: 'file:///photo.png',
            name: 'photo.png',
            type: 'image/png',
          },
        ],
      ]);
    } finally {
      global.FormData = OriginalFormData;
    }
  });

  test('exposes the active multipart request so an upload can be canceled', async () => {
    const OriginalFormData = global.FormData;
    global.FormData = class {
      append() {}
    };
    try {
      const request = Promise.resolve({
        id: 42,
        short_url: 'upload://photo.png',
      });
      request.abort = jest.fn();
      const onRequest = jest.fn(activeRequest => activeRequest.abort());
      await uploadAttachment(
        { authToken: 'present', multipartApi: jest.fn(() => request) },
        {
          uri: 'file:///photo.png',
          name: 'photo.png',
          type: 'image/png',
        },
        'composer',
        onRequest,
      );
      expect(onRequest).toHaveBeenCalledWith(request);
      expect(request.abort).toHaveBeenCalledTimes(1);
    } finally {
      global.FormData = OriginalFormData;
    }
  });

  test('inserts image and file uploads as Discourse markdown in order', () => {
    const raw = appendUploadMarkup('Context', [
      {
        name: 'roof.jpg',
        type: 'image/jpeg',
        upload: { short_url: 'upload://roof.jpg' },
      },
      {
        name: 'guide.pdf',
        type: 'application/pdf',
        upload: { short_url: 'upload://guide.pdf' },
      },
    ]);
    expect(raw).toBe(
      'Context\n\n![roof.jpg](upload://roof.jpg)\n\n[guide.pdf|attachment](upload://guide.pdf)',
    );
  });

  test('passes Chat upload IDs without inventing local media messages', () => {
    expect(
      successfulUploadIds([
        { status: 'succeeded', upload: { id: 8 } },
        { status: 'failed', upload: { id: 9 } },
        { status: 'succeeded', upload: { id: 10 } },
      ]),
    ).toEqual([8, 10]);
  });

  test('recognizes image MIME types and extensions', () => {
    expect(attachmentIsImage({ type: 'image/heic', name: 'capture' })).toBe(
      true,
    );
    expect(attachmentIsImage({ name: 'photo.webp' })).toBe(true);
    expect(attachmentIsImage({ name: 'estimate.pdf' })).toBe(false);
  });

  test('renders cooked post and Chat upload metadata without private fields', () => {
    expect(
      cookedMedia(
        '<p>Hello</p><img src="/uploads/default/photo.png" alt="Roof"><a class="attachment" href="/uploads/default/report.pdf">Report</a>',
        { url: 'https://adjusternetwork.org' },
      ),
    ).toEqual([
      {
        type: 'image',
        url: 'https://adjusternetwork.org/uploads/default/photo.png',
        name: 'Roof',
      },
      {
        type: 'file',
        url: 'https://adjusternetwork.org/uploads/default/report.pdf',
        name: 'Report',
      },
    ]);
    expect(
      chatMedia(
        {
          uploads: [
            {
              id: 1,
              url: '/uploads/default/chat.jpg',
              original_filename: 'chat.jpg',
            },
          ],
        },
        { url: 'https://adjusternetwork.org' },
      )[0].type,
    ).toBe('image');
  });

  test('recognizes the secure attachment anchor cooked by Discourse', () => {
    expect(
      cookedMedia(
        '<p>Safe fixture</p><a class="attachment" href="/secure-uploads/original/1X/synthetic.pdf">synthetic.pdf</a>',
        { url: 'https://staging.adjusternetwork.org' },
      ),
    ).toEqual([
      {
        type: 'file',
        url: 'https://staging.adjusternetwork.org/secure-uploads/original/1X/synthetic.pdf',
        name: 'synthetic.pdf',
      },
    ]);
  });

  test('renders the real staging PDF response as an openable file card', () => {
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, 'fixtures', 'stagingPdfPostReal.json'),
        'utf8',
      ),
    );
    const site = { url: fixture.origin };
    const post = fixture.topic.post_stream.posts[0];
    const media = cookedMedia(post.cooked, site);

    expect(post.raw).toContain('upload://');
    expect(media).toEqual([
      {
        type: 'file',
        url: `${fixture.origin}/secure-uploads/original/1X/0000000000000000000000000000000000000000.pdf`,
        name: 'field-notes.pdf',
      },
    ]);

    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <DiscourseMedia
          media={media}
          site={site}
          resourceKey="topic:90:post:132"
          refreshMedia={jest.fn()}
        />,
      );
    });
    const rendered = JSON.stringify(renderer.toJSON());
    expect(rendered).toContain('field-notes.pdf');
    expect(rendered).toContain('Open attachment');
  });

  test('opens the real PDF route in an authenticated in-app viewer', async () => {
    const site = {
      url: 'https://staging.adjusternetwork.org',
      authToken: 'test-user-api-key',
      clientId: 'test-client',
    };
    const url = `${site.url}/secure-uploads/original/1X/synthetic.pdf`;
    const refreshMedia = jest.fn().mockResolvedValue(url);
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <DiscourseMedia
          media={[{ type: 'file', url, name: 'field-notes.pdf' }]}
          site={site}
          resourceKey="topic:90:post:132"
          refreshMedia={refreshMedia}
        />,
      );
    });

    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Open attachment field-notes.pdf' })
        .props.onPress();
      await Promise.resolve();
    });

    expect(refreshMedia).toHaveBeenCalledWith(0);
    const viewer = renderer.root.findByProps({
      accessibilityLabel: 'Attachment field-notes.pdf',
    });
    expect(viewer.props.source).toEqual({
      uri: url,
      headers: {
        'User-Api-Key': site.authToken,
        'User-Api-Client-Id': site.clientId,
      },
    });
  });

  test('supports canonical and legacy Discourse attachment representations', () => {
    const site = { url: 'https://staging.adjusternetwork.org' };
    expect(
      cookedMedia(
        '<a class="attachment" href="/secure-uploads/original/1X/report.pdf">report.pdf</a>',
        site,
      ),
    ).toHaveLength(1);
    expect(
      cookedMedia(
        '<a class="attachment" href="/secure-media-uploads/original/1X/legacy.pdf">legacy.pdf</a>',
        site,
      ),
    ).toHaveLength(1);
  });

  test('does not treat arbitrary or direct-S3 links as Discourse attachments', () => {
    const site = { url: 'https://staging.adjusternetwork.org' };
    expect(
      cookedMedia(
        '<a href="/secure-uploads/original/1X/not-supported.txt">unsupported file</a>',
        site,
      ),
    ).toEqual([]);
    expect(
      cookedMedia(
        '<a class="attachment" href="https://private-bucket.s3.example/synthetic.pdf">direct storage</a>',
        site,
      ),
    ).toEqual([]);
    expect(
      cookedMedia('<a href="/t/ordinary/12">ordinary.pdf</a>', site),
    ).toEqual([]);
    expect(
      cookedMedia(
        '<a href="https://example.org/report.pdf">report.pdf</a>',
        site,
      ),
    ).toEqual([]);
    expect(
      cookedMedia('<a href="javascript:alert(1)">report.pdf</a>', site),
    ).toEqual([]);
    expect(
      cookedMedia(
        '<a href="data:application/pdf;base64,AA==">report.pdf</a>',
        site,
      ),
    ).toEqual([]);
  });

  test('maps site rejections into useful bounded errors', () => {
    expect(uploadErrorMessage({ status: 413 })).toMatch(/site upload limit/i);
    expect(uploadErrorMessage({ status: 415 })).toMatch(/not supported/i);
    expect(uploadErrorMessage({ status: 429 })).toMatch(/rate-limited/i);
  });

  test('keeps the no-claim-data rule beside the attachment affordance', () => {
    expect(mediaPrivacyReminder).toBe(
      'Keep claim data out. Do not upload insured information, claim numbers, loss addresses, private carrier documents, or other claim-identifying material.',
    );
    const composer = fs.readFileSync(
      path.join(__dirname, '..', 'product', 'AttachmentComposer.js'),
      'utf8',
    );
    expect(composer).toMatch(
      /<\/Pressable>\s*<Text[^>]*>\s*\{mediaPrivacyReminder\}/,
    );
    expect(composer).toContain('Cancel upload of ${item.name}');
  });

  test('discussion composers use the shared queue while Lounge remains text-only', () => {
    const read = file =>
      fs.readFileSync(path.join(__dirname, '..', 'product', file), 'utf8');
    expect(read('ProductScreens.js')).toContain(
      "useAttachmentQueue(site, 'composer')",
    );
    expect(read('NativeTopicScreen.js')).toContain(
      "useAttachmentQueue(site, 'composer')",
    );
    expect(read('NativeLoungeScreen.js')).not.toContain('AttachmentComposer');
    expect(read('NativeLoungeScreen.js')).not.toContain('useAttachmentQueue');
    expect(read('NativeLoungeScreen.js')).not.toContain('upload_ids:');
    expect(read('NativeLoungeScreen.js')).not.toContain("'/uploads.json'");
  });

  test('keeps the approved client dormant behind the Build 3 release gate', () => {
    const config = fs.readFileSync(
      path.join(__dirname, '..', 'adjusterNetworkConfig.js'),
      'utf8',
    );
    const composer = fs.readFileSync(
      path.join(__dirname, '..', 'product', 'AttachmentComposer.js'),
      'utf8',
    );
    expect(config).toContain('mediaUploads: false');
    expect(composer).toContain('mediaUploadsEnabledForSite(site)');
    expect(config).toContain('https://staging.adjusternetwork.org');
    expect(composer).toContain(
      'Photo and file attachments are not available yet.',
    );
    expect(composer).toContain("throw new Error('media_uploads_disabled')");
  });

  test('enables uploads only for the exact isolated staging origin', () => {
    expect(
      mediaUploadsEnabledForSite({
        url: 'https://staging.adjusternetwork.org',
      }),
    ).toBe(true);
    expect(
      mediaUploadsEnabledForSite({ url: 'https://adjusternetwork.org' }),
    ).toBe(false);
    expect(
      mediaUploadsEnabledForSite({
        url: 'https://staging.adjusternetwork.org.attacker.example',
      }),
    ).toBe(false);
    expect(mediaUploadsEnabledForSite({ url: 'not-a-url' })).toBe(false);
  });

  test('coalesces duplicate authorized refreshes for one media resource', async () => {
    let resolveRefresh;
    const refresh = jest
      .fn()
      .mockImplementationOnce(
        () => new Promise(resolve => (resolveRefresh = resolve)),
      )
      .mockResolvedValue('https://authorized.example/fresh');
    const first = refreshSecureMedia('topic:1:post:2:0', refresh);
    const second = refreshSecureMedia('topic:1:post:2:0', refresh);
    expect(first).toBe(second);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    resolveRefresh();
    await first;
    await refreshSecureMedia('topic:1:post:2:0', refresh);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test('resolves file attachments only after an authorized media refresh', async () => {
    const refresh = jest
      .fn()
      .mockResolvedValue(
        'https://staging.adjusternetwork.org/secure-uploads/original/1X/fresh.pdf',
      );
    await expect(
      openSecureMediaFile('topic:1:post:2:0', refresh),
    ).resolves.toBe(
      'https://staging.adjusternetwork.org/secure-uploads/original/1X/fresh.pdf',
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('fails closed when authorized file refresh is unavailable', async () => {
    await expect(
      openSecureMediaFile(
        'topic:1:post:2:0',
        jest
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('denied'), { status: 403 }),
          ),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  test('refreshes aged access after foregrounding without parsing signed URLs', () => {
    expect(shouldRefreshSecureMedia(1000, 240999)).toBe(false);
    expect(shouldRefreshSecureMedia(1000, 241000)).toBe(true);
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'product', 'DiscourseMedia.js'),
      'utf8',
    );
    expect(source).toContain("AppState.addEventListener('change'");
    expect(source).toContain('onError={() => refresh(true)}');
    expect(source).not.toMatch(/amazonaws|cloudfront|s3[.-]/i);
    expect(source).not.toContain('console.');
  });

  test('fails visibly for authorization loss and bounds automatic retries', async () => {
    await expect(
      refreshSecureMedia('topic:3:post:4:0', () =>
        Promise.reject({ status: 403 }),
      ),
    ).rejects.toEqual({ status: 403 });
    expect(mediaRefreshErrorMessage({ status: 403 })).toMatch(/sign in again/i);
    expect(mediaRefreshErrorMessage(new Error('offline'))).toMatch(
      /could not be refreshed/i,
    );
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'product', 'DiscourseMedia.js'),
      'utf8',
    );
    expect(source).toContain('automaticRefreshes.current >= 1');
    expect(source).toContain('Retry secure media');
  });

  test('uses authenticated Discourse surfaces as stable resource identities', () => {
    const topic = fs.readFileSync(
      path.join(__dirname, '..', 'product', 'NativeTopicScreen.js'),
      'utf8',
    );
    expect(topic).toContain('site.jsonApi(`/t/${route.params.topicId}.json`)');
    expect(topic).toContain(
      'resourceKey={`topic:${route.params.topicId}:post:${post.id}`}',
    );
    expect(topic).not.toMatch(/amazonaws|cloudfront|s3[.-]/i);
  });
});
