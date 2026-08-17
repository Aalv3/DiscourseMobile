/* @flow */
'use strict';

import fs from 'fs';
import path from 'path';

jest.mock('@react-native-vector-icons/fontawesome5', () => 'FontAwesome5');
import {
  appendUploadMarkup,
  attachmentIsImage,
  mediaPrivacyReminder,
  successfulUploadIds,
  uploadAttachment,
  uploadErrorMessage,
} from '../product/MediaAttachments';
import { chatMedia, cookedMedia } from '../product/DiscourseMedia';

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
      'Context\n\n![roof.jpg](upload://roof.jpg)\n\n[guide.pdf](upload://guide.pdf)',
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
        '<p>Hello</p><img src="/uploads/default/photo.png" alt="Roof"><a href="/uploads/default/report.pdf">Report</a>',
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

  test('maps site rejections into useful bounded errors', () => {
    expect(uploadErrorMessage({ status: 413 })).toMatch(/site upload limit/i);
    expect(uploadErrorMessage({ status: 415 })).toMatch(/not supported/i);
    expect(uploadErrorMessage({ status: 429 })).toMatch(/rate-limited/i);
  });

  test('keeps the no-claim-data rule beside selected media', () => {
    expect(mediaPrivacyReminder).toMatch(/claim-specific photos/i);
    expect(mediaPrivacyReminder).toMatch(/policy numbers/i);
  });

  test('all native Discourse composers use the shared attachment queue', () => {
    const read = file =>
      fs.readFileSync(path.join(__dirname, '..', 'product', file), 'utf8');
    expect(read('ProductScreens.js')).toContain(
      "useAttachmentQueue(site, 'composer')",
    );
    expect(read('NativeTopicScreen.js')).toContain(
      "useAttachmentQueue(site, 'composer')",
    );
    expect(read('NativeLoungeScreen.js')).toContain(
      "useAttachmentQueue(site, 'chat-composer')",
    );
    expect(read('NativeLoungeScreen.js')).toContain('upload_ids:');
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
    expect(composer).toContain(
      'adjusterNetwork.features.mediaUploads === true',
    );
    expect(composer).toContain(
      'Photo and file attachments are not available yet.',
    );
    expect(composer).toContain("throw new Error('media_uploads_disabled')");
  });
});
