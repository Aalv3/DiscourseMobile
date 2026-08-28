import { consumePendingShareIntent } from '../shareIntentCoordinator';

const context = overrides => ({
  siteManager: { listSites: () => [{ authToken: 'token' }] },
  navigation: { navigate: jest.fn() },
  navigationReady: true,
  nativeModule: { consumeShareIntent: jest.fn().mockResolvedValue(null) },
  openUrl: jest.fn(),
  ...overrides,
});

describe('pending share coordination', () => {
  test('retains the descriptor while logged out', async () => {
    const nativeModule = { consumeShareIntent: jest.fn() };
    const result = await consumePendingShareIntent(
      context({ siteManager: { listSites: () => [] }, nativeModule }),
    );
    expect(result.disposition).toBe('deferred_auth');
    expect(nativeModule.consumeShareIntent).not.toHaveBeenCalled();
  });

  test('retains the descriptor until navigation is ready', async () => {
    const nativeModule = { consumeShareIntent: jest.fn() };
    const result = await consumePendingShareIntent(
      context({ navigation: null, nativeModule }),
    );
    expect(result.disposition).toBe('deferred_navigation');
    expect(nativeModule.consumeShareIntent).not.toHaveBeenCalled();
  });

  test('does not claim the descriptor before the navigation container is ready', async () => {
    const nativeModule = { consumeShareIntent: jest.fn() };
    const result = await consumePendingShareIntent(
      context({ navigationReady: false, nativeModule }),
    );
    expect(result.disposition).toBe('deferred_navigation');
    expect(nativeModule.consumeShareIntent).not.toHaveBeenCalled();
  });

  test('opens Ask with a shared image after authentication', async () => {
    const input = context({
      nativeModule: {
        consumeShareIntent: jest.fn().mockResolvedValue({
          id: 'intent-1',
          kind: 'image',
          uri: 'file:///shared/image.heic',
          name: 'image.heic',
          mime_type: 'image/heic',
          size: 123,
          value: 'shared-image-00000000-0000-0000-0000-000000000000.heic',
        }),
      },
    });
    await expect(consumePendingShareIntent(input)).resolves.toMatchObject({
      disposition: 'opened_ask',
      id: 'intent-1',
    });
    expect(input.navigation.navigate).toHaveBeenCalledWith('HomeWrapper', {
      screen: 'Ask',
      params: expect.objectContaining({
        shareIntentId: 'intent-1',
        sharedImage: expect.objectContaining({
          mimeType: 'image/heic',
          fileSize: 123,
        }),
      }),
    });
  });

  test('preserves text sharing', async () => {
    const input = context({
      nativeModule: {
        consumeShareIntent: jest.fn().mockResolvedValue({
          id: 'text-1',
          kind: 'text',
          value: 'question',
        }),
      },
    });
    await consumePendingShareIntent(input);
    expect(input.navigation.navigate).toHaveBeenCalledWith(
      'HomeWrapper',
      expect.objectContaining({ screen: 'Ask' }),
    );
  });

  test('preserves approved URL sharing', async () => {
    const value = 'https://adjusternetwork.org/t/1';
    const input = context({
      nativeModule: {
        consumeShareIntent: jest.fn().mockResolvedValue({
          id: 'url-1',
          kind: 'url',
          value,
        }),
      },
    });
    await consumePendingShareIntent(input);
    expect(input.openUrl).toHaveBeenCalledWith(value);
  });
});
