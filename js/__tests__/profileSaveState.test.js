import {
  canStartProfileSave,
  profileCooldownSeconds,
  profileRetryAfterMs,
  profileSaveErrorMessage,
  runProfileSaveSequence,
} from '../product/profileSaveState';

describe('profile save state', () => {
  test('profile Save resolves its guard and invokes photo upload before PATCH', async () => {
    expect(typeof canStartProfileSave).toBe('function');
    expect(canStartProfileSave(0, 120000)).toBe(true);
    const calls = [];

    await runProfileSaveSequence({
      photoAsset: { uri: 'file:///selected.jpg' },
      uploadPhoto: jest.fn(async () => {
        calls.push('photo');
        return { avatarTemplate: '/avatar/{size}/2.png' };
      }),
      onPhotoUploaded: jest.fn(async () => calls.push('photo_applied')),
      saveFields: jest.fn(async () => {
        calls.push('patch');
        return { lockVersion: 2 };
      }),
    });

    expect(calls).toEqual(['photo', 'photo_applied', 'patch']);
  });

  test('a fields 429 cannot undo an already successful photo upload', async () => {
    const uploaded = {
      avatarTemplate: '/user_avatar/example/{size}/2.png',
    };
    const onPhotoUploaded = jest.fn();
    const failure = Object.assign(new Error('api_rate_limited'), {
      status: 429,
      retryAfterMs: 21000,
    });
    const saveFields = jest.fn(() => Promise.reject(failure));

    await expect(
      runProfileSaveSequence({
        photoAsset: { uri: 'file:///selected.jpg' },
        uploadPhoto: jest.fn(() => Promise.resolve(uploaded)),
        onPhotoUploaded,
        saveFields,
      }),
    ).rejects.toBe(failure);
    expect(onPhotoUploaded).toHaveBeenCalledWith(uploaded);
    expect(saveFields).toHaveBeenCalledTimes(1);
  });

  test('a photo upload 429 retains pending work and never starts field save', async () => {
    const failure = Object.assign(new Error('api_request_failed'), {
      status: 429,
      userMessages: [
        "You've performed this action too many times. Please wait 21 seconds before trying again.",
      ],
    });
    const saveFields = jest.fn();
    await expect(
      runProfileSaveSequence({
        photoAsset: { uri: 'file:///selected.jpg' },
        uploadPhoto: jest.fn(() => Promise.reject(failure)),
        onPhotoUploaded: jest.fn(),
        saveFields,
      }),
    ).rejects.toBe(failure);
    expect(saveFields).not.toHaveBeenCalled();
    expect(profileRetryAfterMs(failure)).toBe(21000);
  });

  test('successful save completes both operations once', async () => {
    const uploadPhoto = jest.fn(() =>
      Promise.resolve({ avatarTemplate: '/avatar/{size}/2.png' }),
    );
    const saveFields = jest.fn(() => Promise.resolve({ lockVersion: 2 }));
    await expect(
      runProfileSaveSequence({
        photoAsset: { uri: 'file:///selected.jpg' },
        uploadPhoto,
        onPhotoUploaded: jest.fn(),
        saveFields,
      }),
    ).resolves.toMatchObject({ card: { lockVersion: 2 } });
    expect(uploadPhoto).toHaveBeenCalledTimes(1);
    expect(saveFields).toHaveBeenCalledTimes(1);
  });

  test('uses bounded retry copy and directed cooldown', () => {
    const error = { status: 429, retryAfterMs: 21000 };
    expect(profileRetryAfterMs(error)).toBe(21000);
    expect(profileSaveErrorMessage(error, 21000)).toBe(
      'Please wait 21 seconds before trying again. Your profile changes and photo are still here.',
    );
    expect(profileRetryAfterMs({ status: 429 })).toBe(30000);
    expect(profileCooldownSeconds(121000, 100000)).toBe(21);
    expect(profileCooldownSeconds(121000, 121000)).toBe(0);
    expect(profileCooldownSeconds(121000, 122000)).toBe(0);
    expect(canStartProfileSave(121000, 120000)).toBe(false);
    expect(canStartProfileSave(121000, 121000)).toBe(true);
  });

  test('reserves preparation copy for actual client preparation failures', () => {
    expect(profileSaveErrorMessage(new Error('invalid_upload_asset'), 0)).toBe(
      'Your profile photo could not be prepared.',
    );
    expect(
      profileSaveErrorMessage(
        { userMessages: ['profile photo processing failed'] },
        0,
      ),
    ).toBe('profile photo processing failed');
  });
});
